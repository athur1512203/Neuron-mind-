const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Neuro Chat V0 grounded answers from KnowledgeContext", async (t) => {
  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };

  process.env.JWT_SECRET = "test-only-neuro-chat-secret";
  const { prisma } = require("../dist/lib/prisma");
  const { answerFromKnowledge } = require("../dist/services/neuro.service");
  const { app } = require("../dist/app");
  const jwt = require("jsonwebtoken");
  const storage = require("../dist/storage");
  t.mock.method(storage, "getStorageProvider", () => assert.fail("Neuro Chat must not access storage"));

  const updatedAt = new Date("2026-09-29T00:00:00Z");
  const neurons = new Map([
    ["a", { id: "a", subjectId: "subject-a", owner: "alice", name: "Thu nhập",
      textContent: "Thu nhập là tiền nhận được từ công việc.", note: null, keyPoints: "Ghi chép nguồn thu",
      memoryMethod: "", application: "Lập ngân sách tháng", updatedAt, images: [], audio: [] }],
    ["b", { id: "b", subjectId: "subject-b", owner: "bob", name: "Private",
      textContent: "Bí mật của Bob", note: null, keyPoints: "", memoryMethod: "", application: "", updatedAt, images: [], audio: [] }],
  ]);
  const notes = new Map([
    ["a", { id: "note-a", neuronId: "a", content: "Cách nhớ: chia thu nhập thành nhu cầu và tiết kiệm.", updatedAt }],
  ]);

  mockPrisma(prisma.neuron, "findFirst", async ({ where, select }) => {
    assert.equal(typeof where.subject.userId, "string");
    const neuron = neurons.get(where.id);
    if (!neuron || neuron.owner !== where.subject.userId) return null;
    if (select) {
      return neuron;
    }
    return neuron;
  });
  mockPrisma(prisma.markdownNote, "findFirst", async ({ where }) => {
    const neuron = neurons.get(where.neuronId);
    const note = notes.get(where.neuronId);
    if (!note || neuron?.owner !== where.neuron.subject.userId) return null;
    return { ...note, neuron: { subjectId: neuron.subjectId, name: neuron.name } };
  });
  for (const method of ["findMany", "findFirst", "findUnique"]) {
    mockPrisma(prisma.document, method, () => assert.fail("Neuro Chat must not query documents"));
  }

  await t.test("extracts matching passages and citations without inventing extra facts", () => {
    const result = answerFromKnowledge({
      neuronId: "a",
      subjectId: "subject-a",
      sources: [{
        type: "NEURON", sourceId: "a", neuronId: "a", subjectId: "subject-a", title: "Thu nhập",
        content: "## Text\nThu nhập là tiền nhận được từ công việc.\n\n## Application\nLập ngân sách tháng",
        updatedAt: updatedAt.toISOString(),
        provenance: { sourceType: "NEURON", sourceId: "a", neuronId: "a", subjectId: "subject-a" },
      }],
    }, "ngân sách tháng là gì");
    assert.equal(result.grounded, true);
    assert.match(result.reply, /Lập ngân sách tháng/);
    assert.equal(result.reply.includes("không có trong nguồn"), false);
    assert.deepEqual(result.citations, [{
      type: "NEURON", sourceId: "a", title: "Thu nhập", neuronId: "a", subjectId: "subject-a",
    }]);
  });

  await t.test("unmatched questions do not quote unrelated knowledge", () => {
    const result = answerFromKnowledge({
      neuronId: "a",
      subjectId: "subject-a",
      sources: [{
        type: "NEURON", sourceId: "a", neuronId: "a", subjectId: "subject-a", title: "Thu nhập",
        content: "Thu nhập là tiền nhận được từ công việc.",
        updatedAt: updatedAt.toISOString(),
        provenance: { sourceType: "NEURON", sourceId: "a", neuronId: "a", subjectId: "subject-a" },
      }],
    }, "quantum entanglement");
    assert.equal(result.citations.length, 0);
    assert.match(result.reply, /không tìm thấy/i);
    assert.equal(result.reply.includes("Thu nhập là tiền"), false);
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = (user = "alice") => ({
    Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: user })}`,
    "Content-Type": "application/json",
  });

  try {
    await t.test("POST chat uses owned knowledge and returns citations", async () => {
      const response = await fetch(`${base}/neurons/a/chat`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ message: "tiết kiệm thu nhập như thế nào" }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.neuronId, "a");
      assert.equal(body.subjectId, "subject-a");
      assert.equal(body.grounded, true);
      assert.match(body.reply, /nhu cầu và tiết kiệm/);
      assert.ok(body.citations.some((item) => item.type === "MARKDOWN" && item.sourceId === "note-a"));
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes("Bí mật của Bob"), false);
    });

    await t.test("foreign neuron is 404 and empty message is 400", async () => {
      const foreign = await fetch(`${base}/neurons/b/chat`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({ message: "hello" }),
      });
      assert.equal(foreign.status, 404);
      const invalid = await fetch(`${base}/neurons/a/chat`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ message: "   " }),
      });
      assert.equal(invalid.status, 400);
    });

    await t.test("unauthenticated chat is rejected", async () => {
      const response = await fetch(`${base}/neurons/a/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });
      assert.equal(response.status, 401);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
