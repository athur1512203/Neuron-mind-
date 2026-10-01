const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");

test("Auth and core CRUD HTTP with mocked Prisma", async (t) => {
  process.env.JWT_SECRET = "test-only-auth-crud-secret";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.REGISTER_RATE_LIMIT_MAX = "1000";
  process.env.REGISTER_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.UPLOAD_RATE_LIMIT_MAX = "1000";

  const { prisma } = require("../dist/lib/prisma");
  const { app } = require("../dist/app");
  const jwt = require("jsonwebtoken");

  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };

  const now = new Date("2026-09-29T00:00:00Z");
  /** @type {Map<string, any>} */
  const usersById = new Map();
  /** @type {Map<string, any>} */
  const usersByEmail = new Map();
  /** @type {Map<string, any>} */
  const subjects = new Map();
  /** @type {Map<string, any>} */
  const neurons = new Map();
  /** @type {Map<string, any>} */
  const connections = new Map();

  const prismaUnique = (code) => new Prisma.PrismaClientKnownRequestError("unique", { code, clientVersion: "test" });

  mockPrisma(prisma.user, "create", async ({ data, select }) => {
    if (usersByEmail.has(data.email)) throw prismaUnique("P2002");
    const user = {
      id: `user-${usersById.size + 1}`,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    usersById.set(user.id, user);
    usersByEmail.set(user.email, user);
    if (select) {
      const picked = {};
      for (const key of Object.keys(select)) if (select[key]) picked[key] = user[key];
      return picked;
    }
    return user;
  });
  mockPrisma(prisma.user, "findUnique", async ({ where, select }) => {
    const user = where.id ? usersById.get(where.id) : usersByEmail.get(where.email);
    if (!user) return null;
    if (select) {
      const picked = {};
      for (const key of Object.keys(select)) if (select[key]) picked[key] = user[key];
      return picked;
    }
    return user;
  });
  mockPrisma(prisma.subject, "create", async ({ data }) => {
    const subject = {
      id: `subject-${subjects.size + 1}`,
      userId: data.userId,
      name: data.name,
      color: data.color ?? null,
      createdAt: now,
      updatedAt: now,
    };
    subjects.set(subject.id, subject);
    return subject;
  });
  mockPrisma(prisma.subject, "findMany", async ({ where }) => {
    return [...subjects.values()]
      .filter((subject) => subject.userId === where.userId)
      .map((subject) => ({
        ...subject,
        _count: {
          neurons: [...neurons.values()].filter((neuron) => neuron.subjectId === subject.id).length,
          connections: [...connections.values()].filter((connection) => connection.subjectId === subject.id).length,
        },
      }));
  });
  mockPrisma(prisma.subject, "findFirst", async ({ where }) => {
    const subject = subjects.get(where.id);
    if (!subject || subject.userId !== where.userId) return null;
    return {
      ...subject,
      _count: {
        neurons: [...neurons.values()].filter((neuron) => neuron.subjectId === subject.id).length,
        connections: [...connections.values()].filter((connection) => connection.subjectId === subject.id).length,
      },
    };
  });
  mockPrisma(prisma.subject, "delete", async ({ where }) => {
    const subject = subjects.get(where.id);
    subjects.delete(where.id);
    return subject;
  });
  mockPrisma(prisma.neuron, "create", async ({ data }) => {
    const neuron = {
      id: `neuron-${neurons.size + 1}`,
      ...data,
      textContent: data.textContent ?? "",
      keyPoints: data.keyPoints ?? "",
      memoryMethod: data.memoryMethod ?? "",
      application: data.application ?? "",
      positionX: data.positionX ?? 0,
      positionY: data.positionY ?? 0,
      positionZ: data.positionZ ?? 0,
      createdAt: now,
      updatedAt: now,
      images: [],
      audio: [],
    };
    neurons.set(neuron.id, neuron);
    return neuron;
  });
  mockPrisma(prisma.neuron, "findMany", async ({ where }) => {
    const ids = where.id?.in;
    return [...neurons.values()].filter((neuron) => {
      if (ids) return ids.includes(neuron.id) && neuron.subjectId === where.subjectId;
      return neuron.subjectId === where.subjectId;
    });
  });
  mockPrisma(prisma.neuron, "findFirst", async ({ where }) => {
    const neuron = neurons.get(where.id);
    if (!neuron) return null;
    const subject = subjects.get(neuron.subjectId);
    if (!subject || subject.userId !== where.subject.userId) return null;
    return { ...neuron, images: [], audio: [] };
  });
  mockPrisma(prisma.neuronConnection, "create", async ({ data }) => {
    const duplicate = [...connections.values()].some((connection) =>
      connection.subjectId === data.subjectId
      && connection.sourceNeuronId === data.sourceNeuronId
      && connection.targetNeuronId === data.targetNeuronId,
    );
    if (duplicate) throw prismaUnique("P2002");
    const connection = { id: `conn-${connections.size + 1}`, createdAt: now, ...data };
    connections.set(connection.id, connection);
    return connection;
  });
  mockPrisma(prisma.neuronConnection, "findFirst", async ({ where }) => {
    const connection = connections.get(where.id);
    if (!connection) return null;
    const subject = subjects.get(connection.subjectId);
    if (!subject || subject.userId !== where.subject.userId) return null;
    return connection;
  });
  mockPrisma(prisma.neuronConnection, "delete", async ({ where }) => {
    const connection = connections.get(where.id);
    connections.delete(where.id);
    return connection;
  });
  mockPrisma(prisma.document, "findMany", async () => []);

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const json = { "Content-Type": "application/json" };
  const authHeaders = (userId) => ({
    ...json,
    Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: userId })}`,
  });

  try {
    let alice;
    let bob;
    let subjectA;
    let neuron1;
    let neuron2;

    await t.test("register then duplicate email is rejected", async () => {
      const created = await fetch(`${base}/auth/register`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ email: "alice@example.com", password: "password1" }),
      });
      assert.equal(created.status, 201);
      const body = await created.json();
      assert.equal(body.user.email, "alice@example.com");
      assert.equal(typeof body.token, "string");
      assert.equal(body.user.passwordHash, undefined);
      alice = body.user;
      const duplicate = await fetch(`${base}/auth/register`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ email: "alice@example.com", password: "password1" }),
      });
      assert.equal(duplicate.status, 409);
    });

    await t.test("login success and invalid credentials", async () => {
      const ok = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ email: "alice@example.com", password: "password1" }),
      });
      assert.equal(ok.status, 200);
      const body = await ok.json();
      assert.equal(body.user.id, alice.id);
      const bad = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ email: "alice@example.com", password: "wrongpass" }),
      });
      assert.equal(bad.status, 401);
    });

    await t.test("authenticated me and unauthorized access", async () => {
      const me = await fetch(`${base}/users/me`, { headers: authHeaders(alice.id) });
      assert.equal(me.status, 200);
      assert.deepEqual((await me.json()).email, "alice@example.com");
      const none = await fetch(`${base}/users/me`);
      assert.equal(none.status, 401);
      const subjectsRes = await fetch(`${base}/subjects`);
      assert.equal(subjectsRes.status, 401);
    });

    await t.test("subject ownership isolation", async () => {
      const bobRes = await fetch(`${base}/auth/register`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ email: "bob@example.com", password: "password1" }),
      });
      bob = (await bobRes.json()).user;
      const created = await fetch(`${base}/subjects`, {
        method: "POST",
        headers: authHeaders(alice.id),
        body: JSON.stringify({ name: "Alice space", color: "#22c55e" }),
      });
      assert.equal(created.status, 201);
      subjectA = await created.json();
      const listed = await fetch(`${base}/subjects`, { headers: authHeaders(bob.id) });
      assert.equal(listed.status, 200);
      assert.deepEqual(await listed.json(), []);
      const foreign = await fetch(`${base}/subjects/${subjectA.id}`, { headers: authHeaders(bob.id) });
      assert.equal(foreign.status, 404);
    });

    await t.test("neuron ownership isolation", async () => {
      const created = await fetch(`${base}/subjects/${subjectA.id}/neurons`, {
        method: "POST",
        headers: authHeaders(alice.id),
        body: JSON.stringify({ name: "N1", color: "#22c55e" }),
      });
      assert.equal(created.status, 201);
      neuron1 = await created.json();
      const second = await fetch(`${base}/subjects/${subjectA.id}/neurons`, {
        method: "POST",
        headers: authHeaders(alice.id),
        body: JSON.stringify({ name: "N2", color: "#3b82f6" }),
      });
      neuron2 = await second.json();
      const foreign = await fetch(`${base}/neurons/${neuron1.id}`, { headers: authHeaders(bob.id) });
      assert.equal(foreign.status, 404);
      const foreignPatch = await fetch(`${base}/neurons/${neuron1.id}`, {
        method: "PATCH",
        headers: authHeaders(bob.id),
        body: JSON.stringify({ name: "stolen" }),
      });
      assert.equal(foreignPatch.status, 404);
      const foreignNote = await fetch(`${base}/neurons/${neuron1.id}/note`, { headers: authHeaders(bob.id) });
      assert.equal(foreignNote.status, 404);
    });

    await t.test("connections reject self, duplicate and foreign access", async () => {
      const self = await fetch(`${base}/subjects/${subjectA.id}/connections`, {
        method: "POST",
        headers: authHeaders(alice.id),
        body: JSON.stringify({ sourceNeuronId: neuron1.id, targetNeuronId: neuron1.id }),
      });
      assert.equal(self.status, 400);
      const created = await fetch(`${base}/subjects/${subjectA.id}/connections`, {
        method: "POST",
        headers: authHeaders(alice.id),
        body: JSON.stringify({ sourceNeuronId: neuron1.id, targetNeuronId: neuron2.id }),
      });
      assert.equal(created.status, 201);
      const connection = await created.json();
      const duplicate = await fetch(`${base}/subjects/${subjectA.id}/connections`, {
        method: "POST",
        headers: authHeaders(alice.id),
        body: JSON.stringify({ sourceNeuronId: neuron2.id, targetNeuronId: neuron1.id }),
      });
      assert.equal(duplicate.status, 409);
      const foreign = await fetch(`${base}/connections/${connection.id}`, {
        method: "DELETE",
        headers: authHeaders(bob.id),
      });
      assert.equal(foreign.status, 404);
      const deleted = await fetch(`${base}/connections/${connection.id}`, {
        method: "DELETE",
        headers: authHeaders(alice.id),
      });
      assert.equal(deleted.status, 204);
    });

    await t.test("register rate limit returns 429 without leaking secrets", async () => {
      process.env.REGISTER_RATE_LIMIT_MAX = "2";
      const headers = { ...json, "X-Forwarded-For": "198.51.100.20" };
      const first = await fetch(`${base}/auth/register`, {
        method: "POST", headers, body: JSON.stringify({ email: "r1@example.com", password: "password1" }),
      });
      const second = await fetch(`${base}/auth/register`, {
        method: "POST", headers, body: JSON.stringify({ email: "r2@example.com", password: "password1" }),
      });
      const third = await fetch(`${base}/auth/register`, {
        method: "POST", headers, body: JSON.stringify({ email: "r3@example.com", password: "password1" }),
      });
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.equal(third.status, 429);
      const body = await third.json();
      assert.equal(body.error.code, "RATE_LIMIT_EXCEEDED");
      assert.equal(JSON.stringify(body).includes("passwordHash"), false);
      process.env.REGISTER_RATE_LIMIT_MAX = "1000";
    });

    await t.test("login rate limit returns 429 without leaking secrets", async () => {
      process.env.AUTH_RATE_LIMIT_MAX = "2";
      const headers = { ...json, "X-Forwarded-For": "203.0.113.50" };
      const payload = JSON.stringify({ email: "alice@example.com", password: "wrongpass" });
      const first = await fetch(`${base}/auth/login`, { method: "POST", headers, body: payload });
      const second = await fetch(`${base}/auth/login`, { method: "POST", headers, body: payload });
      const third = await fetch(`${base}/auth/login`, { method: "POST", headers, body: payload });
      assert.equal(first.status, 401);
      assert.equal(second.status, 401);
      assert.equal(third.status, 429);
      const body = await third.json();
      assert.equal(body.error.code, "RATE_LIMIT_EXCEEDED");
      assert.equal(JSON.stringify(body).includes("password"), false);
      assert.equal(JSON.stringify(body).includes("passwordHash"), false);
      process.env.AUTH_RATE_LIMIT_MAX = "1000";
    });

    await t.test("JWT with a non-HS256 algorithm is rejected", async () => {
      const token = jwt.sign({}, process.env.JWT_SECRET, { subject: alice.id, algorithm: "HS512" });
      const response = await fetch(`${base}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 401);
      const expired = jwt.sign({}, process.env.JWT_SECRET, { subject: alice.id, algorithm: "HS256", expiresIn: -10 });
      const expiredRes = await fetch(`${base}/users/me`, { headers: { Authorization: `Bearer ${expired}` } });
      assert.equal(expiredRes.status, 401);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
