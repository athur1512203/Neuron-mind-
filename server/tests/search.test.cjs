const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Global Search HTTP regression with mocked Prisma", async (t) => {
  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };
  process.env.JWT_SECRET = "test-only-search-secret";
  const { prisma } = require("../dist/lib/prisma");
  const { app } = require("../dist/app");
  const jwt = require("jsonwebtoken");
  const old = new Date("2026-09-01T00:00:00Z");
  const recent = new Date("2026-09-29T00:00:00Z");
  const subject = { id: "subject-a", name: "Subject A", userId: "alice" };
  const neuron = (id, name, extra = {}) => ({
    id, name, subjectId: subject.id, subject, textContent: "", note: null,
    keyPoints: "", memoryMethod: "", application: "", updatedAt: old, ...extra,
  });
  const neurons = [
    neuron("n-exact", "Alpha"),
    neuron("n-prefix", "Alpha waves", { updatedAt: recent }),
    neuron("n-contains", "About alpha"),
    neuron("n-body", "Learning", { textContent: "Learn ALPHA today", note: "legacyneedle",
      keyPoints: "keyneedle", memoryMethod: "memoryneedle", application: "applicationneedle" }),
    neuron("n-foreign", "Alpha", { subject: { ...subject, userId: "bob" } }),
  ];
  const notes = [
    { id: "note", neuronId: "n-body", neuron: neurons[3], content: "# Alpha markdown", updatedAt: recent },
    { id: "note-foreign", neuronId: "n-foreign", neuron: neurons[4], content: "alpha", updatedAt: recent },
  ];
  const document = (id, originalName, extra = {}) => ({
    id, originalName, neuronId: "n-body", neuron: neurons[3], storedName: "opaque-filename",
    mimeType: "application/pdf", extension: ".pdf", checksum: "checksumneedle",
    storagePath: "private-path", storageKey: "private-key", updatedAt: old, ...extra,
  });
  const documents = [
    document("doc-exact", "alpha", { updatedAt: recent }),
    document("doc-prefix", "alpha.pdf"),
    document("doc-meta", "Report", { mimeType: "alpha/type" }),
    document("doc-foreign", "alpha", { neuronId: "n-foreign", neuron: neurons[4] }),
  ];
  const calls = [];
  mockPrisma(prisma.subject, "findMany", async ({ where, take }) => {
    assert.equal(where.userId, "alice");
    assert.ok(take <= 100);
    return [{ id: subject.id }];
  });
  const match = (row, clause) => Object.entries(clause).every(([field, filter]) => {
    assert.equal(filter.mode, "insensitive");
    return String(row[field] ?? "").toLowerCase().includes(filter.contains.toLowerCase());
  });
  for (const [type, delegate, rows] of [["neuron", prisma.neuron, neurons], ["markdown", prisma.markdownNote, notes], ["document", prisma.document, documents]]) {
    mockPrisma(delegate, "findMany", async ({ where, orderBy, take, select }) => {
      if (type === "neuron" && select?.id && Object.keys(select).length === 1) {
        assert.equal(where.subject.userId, "alice");
        assert.deepEqual(where.subjectId.in, [subject.id]);
        return neurons.filter((row) => row.subject.userId === where.subject.userId).map(({ id }) => ({ id }));
      }
      calls.push({ type, where, take });
      const userId = type === "neuron" ? where.subject.userId : where.neuron.subject.userId;
      assert.equal(typeof userId, "string");
      assert.deepEqual(orderBy, [{ updatedAt: "desc" }, { id: "asc" }]);
      return rows.filter((row) => (type === "neuron" ? row.subject : row.neuron.subject).userId === userId)
        .filter((row) => type === "markdown" ? match(row, { content: where.content }) : where.OR.some((clause) => match(row, clause)))
        .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, take);
    });
  }
  const storage = require("../dist/storage");
  t.mock.method(storage, "getStorageProvider", () => assert.fail("Search must not read document binaries"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/search`;
  const headers = { Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: "alice" })}` };
  const search = async (query) => {
    const response = await fetch(`${base}?${query}`, { headers });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    await t.test("rank, recency, snippets and opening IDs remain compatible", async () => {
      const body = await search("q=%20ALPHA%20");
      assert.equal(body.query, "ALPHA");
      assert.equal(body.limit, 20);
      assert.deepEqual(body.results.map((r) => r.id), [
        "doc-exact", "n-exact", "n-prefix", "doc-prefix", "n-contains", "n-body", "note", "doc-meta",
      ]);
      assert.deepEqual(body.results.find((r) => r.id === "note"), {
        id: "note", type: "markdown", title: "Learning", snippet: "# Alpha markdown",
        neuronId: "n-body", subjectId: "subject-a", subjectName: "Subject A", updatedAt: recent.toISOString(),
      });
      assert.equal(body.results.find((r) => r.id === "n-body").snippet, "Learn ALPHA today");
      for (const result of body.results) {
        assert.ok(result.neuronId && result.subjectId);
        assert.equal(result.rank, undefined);
      }
      const serialized = JSON.stringify(body);
      for (const value of ["storageKey", "storagePath", "private-key", "private-path", "foreign"]) {
        assert.equal(serialized.includes(value), false);
      }
    });
    await t.test("all neuron text fields remain searchable", async () => {
      for (const q of ["legacyneedle", "keyneedle", "memoryneedle", "applicationneedle"]) {
        const body = await search(`q=${q}`);
        assert.deepEqual(body.results.map((r) => r.id), ["n-body"]);
        assert.equal(body.results[0].snippet, q);
      }
    });
    await t.test("document metadata matching remains available without extraction", async () => {
      for (const q of ["application%2Fpdf", ".pdf"]) {
        const body = await search(`q=${q}`);
        assert.ok(body.results.length > 0);
        assert.ok(body.results.every((r) => r.type === "document"));
      }
    });
    await t.test("storedName and checksum are not user-facing search matches", async () => {
      for (const q of ["opaque-filename", "checksumneedle"]) {
        const body = await search(`q=${q}`);
        assert.deepEqual(body.results, []);
      }
    });
    await t.test("empty queries avoid database calls; unmatched queries return no results", async () => {
      const before = calls.length;
      assert.deepEqual((await search("q=%20%20")).results, []);
      assert.equal(calls.length, before);
      assert.deepEqual((await search("q=unmatched-token")).results, []);
    });
    await t.test("limits preserve defaults, cap and candidate window", async () => {
      assert.equal((await search("q=alpha&limit=1")).results.length, 1);
      assert.ok(calls.slice(-3).every((c) => c.take === 2));
      assert.equal((await search("q=alpha&limit=999")).limit, 50);
      assert.ok(calls.slice(-3).every((c) => c.take === 50));
      assert.equal((await search("q=alpha&limit=1.9")).limit, 1);
      for (const limit of ["0", "-1", "invalid"]) assert.equal((await search(`q=alpha&limit=${limit}`)).limit, 20);
    });
    await t.test("auth is required and client-supplied userId cannot override JWT", async () => {
      const before = calls.length;
      assert.equal((await fetch(`${base}?q=alpha`)).status, 401);
      assert.equal(calls.length, before);
      const body = await search("q=alpha&userId=bob");
      assert.ok(body.results.every((r) => !r.id.includes("foreign")));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
