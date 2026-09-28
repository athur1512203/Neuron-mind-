const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("MarkdownNote migration cascades on neuron delete", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "prisma", "migrations", "20260928030000_add_markdown_notes", "migration.sql"),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE "MarkdownNote"/);
  assert.match(sql, /FOREIGN KEY \("neuronId"\) REFERENCES "Neuron"\("id"\) ON DELETE CASCADE/);
});

test("Markdown note HTTP API with mocked Prisma", async (t) => {
  process.env.JWT_SECRET = "test-only-markdown-secret";
  const { prisma } = require("../dist/lib/prisma");
  const { app } = require("../dist/app");
  const jwt = require("jsonwebtoken");
  const { MARKDOWN_NOTE_MAX_BYTES, assertMarkdownContent } = require("../dist/services/markdown-note.service");

  const owners = {
    "neuron-a": "owner",
    "neuron-b": "owner",
    "neuron-other": "other",
  };
  /** @type {Map<string, { id: string, neuronId: string, content: string, createdAt: Date, updatedAt: Date }>} */
  const notes = new Map();

  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => {
      delegate[method] = original;
    });
  };

  mockPrisma(prisma.neuron, "findFirst", async ({ where }) => {
    const owner = owners[where.id];
    if (!owner || owner !== where.subject.userId) return null;
    return { id: where.id, subjectId: "subject", images: [], audio: [] };
  });
  mockPrisma(prisma.neuron, "delete", async ({ where }) => {
    notes.delete(where.id);
    return { id: where.id };
  });
  mockPrisma(prisma.document, "findMany", async () => []);
  mockPrisma(prisma.markdownNote, "findUnique", async ({ where }) => notes.get(where.neuronId) ?? null);
  mockPrisma(prisma.markdownNote, "upsert", async ({ where, create, update }) => {
    const existing = notes.get(where.neuronId);
    const now = new Date();
    const record = existing
      ? { ...existing, content: update.content, updatedAt: now }
      : { id: `note-${notes.size + 1}`, neuronId: create.neuronId, content: create.content, createdAt: now, updatedAt: now };
    notes.set(record.neuronId, record);
    return record;
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = (user = "owner") => ({
    Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: user })}`,
    "Content-Type": "application/json",
  });
  const noteUrl = (id) => `${base}/neurons/${id}/note`;

  try {
    await t.test("GET missing note returns null content", async () => {
      const response = await fetch(noteUrl("neuron-a"), { headers: headers() });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { neuronId: "neuron-a", content: null });
    });

    await t.test("PUT creates then GET returns markdown", async () => {
      const created = await fetch(noteUrl("neuron-a"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: "# Note A" }),
      });
      assert.equal(created.status, 200);
      const body = await created.json();
      assert.equal(body.neuronId, "neuron-a");
      assert.equal(body.content, "# Note A");
      const again = await fetch(noteUrl("neuron-a"), { headers: headers() });
      assert.equal((await again.json()).content, "# Note A");
    });

    await t.test("PUT updates existing note", async () => {
      const response = await fetch(noteUrl("neuron-a"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: "# Note A updated" }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).content, "# Note A updated");
    });

    await t.test("empty string content is allowed", async () => {
      const response = await fetch(noteUrl("neuron-a"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: "" }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).content, "");
    });

    await t.test("non-string content is rejected", async () => {
      const response = await fetch(noteUrl("neuron-a"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: 12 }),
      });
      assert.equal(response.status, 400);
    });

    await t.test("content over 1MB UTF-8 is rejected", async () => {
      assert.throws(() => assertMarkdownContent("a".repeat(MARKDOWN_NOTE_MAX_BYTES + 1)));
      assert.equal(Buffer.byteLength("é".repeat(MARKDOWN_NOTE_MAX_BYTES / 2 + 1), "utf8") > MARKDOWN_NOTE_MAX_BYTES, true);
      assert.throws(() => assertMarkdownContent("é".repeat(MARKDOWN_NOTE_MAX_BYTES / 2 + 1)));
      const response = await fetch(noteUrl("neuron-a"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: "a".repeat(MARKDOWN_NOTE_MAX_BYTES + 1) }),
      });
      assert.equal(response.status, 413);
    });

    await t.test("User A cannot GET or PUT User B note", async () => {
      assert.equal((await fetch(noteUrl("neuron-other"), { headers: headers() })).status, 404);
      assert.equal(
        (
          await fetch(noteUrl("neuron-other"), {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify({ content: "stolen" }),
          })
        ).status,
        404,
      );
      assert.equal(notes.has("neuron-other"), false);
    });

    await t.test("two neurons keep independent notes", async () => {
      await fetch(noteUrl("neuron-a"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: "# A" }),
      });
      await fetch(noteUrl("neuron-b"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ content: "# B" }),
      });
      assert.equal((await (await fetch(noteUrl("neuron-a"), { headers: headers() })).json()).content, "# A");
      assert.equal((await (await fetch(noteUrl("neuron-b"), { headers: headers() })).json()).content, "# B");
    });

    await t.test("delete neuron removes markdown note via cascade hook", async () => {
      assert.equal(notes.has("neuron-a"), true);
      const response = await fetch(`${base}/neurons/neuron-a`, { method: "DELETE", headers: headers() });
      assert.equal(response.status, 204);
      assert.equal(notes.has("neuron-a"), false);
      assert.equal(notes.get("neuron-b")?.content, "# B");
    });

    await t.test("unauthenticated requests are rejected", async () => {
      assert.equal((await fetch(noteUrl("neuron-b"))).status, 401);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
