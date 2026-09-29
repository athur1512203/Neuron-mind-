const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prisma } = require("../dist/lib/prisma");
const { knowledgeService, KnowledgeService } = require("../dist/services/knowledge.service");
const { NeuronKnowledgeProvider, MarkdownKnowledgeProvider } = require("../dist/knowledge/providers");

test("Knowledge boundary with ownership-aware mocked Prisma", async (t) => {
  // Prisma delegates are proxies; restore assignments explicitly like API tests.
  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };
  const updatedAt = new Date("2026-09-29T00:00:00Z");
  const neurons = new Map([
    ["a", { id: "a", subjectId: "subject-a", owner: "alice", name: "Learning",
      textContent: "Neuron text", note: "Legacy note", keyPoints: "Key point",
      memoryMethod: "Recall", application: "Practice", updatedAt,
      storageKey: "private-key", storagePath: "private-path", secret: "private-secret" }],
    ["b", { id: "b", subjectId: "subject-b", owner: "bob", name: "Private",
      textContent: "Bob text", note: null, keyPoints: "", memoryMethod: "", application: "", updatedAt }],
  ]);
  const notes = new Map([
    ["a", { id: "note-a", neuronId: "a", content: "# Markdown\n\n  preserve spacing\n", updatedAt,
      storageKey: "private-key", secret: "private-secret" }],
    ["b", { id: "note-b", neuronId: "b", content: "Bob markdown", updatedAt }],
  ]);
  let queryCount = 0;
  mockPrisma(prisma.neuron, "findFirst", async ({ where, select }) => {
    queryCount++;
    assert.equal(typeof where.subject.userId, "string");
    assert.equal(typeof where.id, "string");
    if (select) assert.deepEqual(Object.keys(select).sort(), [
      "application", "id", "keyPoints", "memoryMethod", "name", "note", "subjectId", "textContent", "updatedAt",
    ]);
    const neuron = neurons.get(where.id);
    return neuron?.owner === where.subject.userId ? neuron : null;
  });
  mockPrisma(prisma.markdownNote, "findFirst", async ({ where, select }) => {
    queryCount++;
    assert.equal(typeof where.neuron.subject.userId, "string");
    assert.deepEqual(Object.keys(select).sort(), ["content", "id", "neuron", "neuronId", "updatedAt"]);
    assert.deepEqual(select.neuron, { select: { subjectId: true, name: true } });
    const neuron = neurons.get(where.neuronId);
    const note = notes.get(where.neuronId);
    return note && neuron?.owner === where.neuron.subject.userId ? { ...note, neuron } : null;
  });
  // Fail immediately if any knowledge read reaches attachments or binary storage.
  for (const method of ["findMany", "findFirst", "findUnique"]) {
    mockPrisma(prisma.document, method, () => assert.fail("Knowledge must not query documents"));
  }
  const storage = require("../dist/storage");
  t.mock.method(storage, "getStorageProvider", () => assert.fail("Knowledge must not access storage"));
  const scope = { neuronId: "a", userId: "alice" };
  t.after(() => prisma.$disconnect());

  await t.test("normalizes all real neuron text fields and provenance", async () => {
    const [source] = await new NeuronKnowledgeProvider().getSources(scope);
    assert.deepEqual(source, {
      type: "NEURON", sourceId: "a", neuronId: "a", subjectId: "subject-a", title: "Learning",
      content: "## Text\nNeuron text\n\n## Note\nLegacy note\n\n## Key points\nKey point\n\n## Memory method\nRecall\n\n## Application\nPractice",
      updatedAt: updatedAt.toISOString(),
      provenance: { sourceType: "NEURON", sourceId: "a", neuronId: "a", subjectId: "subject-a" },
    });
  });
  await t.test("preserves raw markdown and derives title/subject from its neuron", async () => {
    const [source] = await new MarkdownKnowledgeProvider().getSources(scope);
    assert.deepEqual(source, {
      type: "MARKDOWN", sourceId: "note-a", neuronId: "a", subjectId: "subject-a", title: "Learning",
      content: notes.get("a").content, updatedAt: updatedAt.toISOString(),
      provenance: { sourceType: "MARKDOWN", sourceId: "note-a", neuronId: "a", subjectId: "subject-a" },
    });
  });
  await t.test("context and source-list operation return only the selected neuron", async () => {
    const context = await knowledgeService.getKnowledgeContext(scope);
    assert.equal(context.neuronId, "a");
    assert.equal(context.subjectId, "subject-a");
    assert.deepEqual(context.sources.map((s) => s.type), ["NEURON", "MARKDOWN"]);
    assert.ok(context.sources.every((s) => s.neuronId === "a"));
    assert.deepEqual(await knowledgeService.getKnowledgeSourcesForNeuron(scope), context.sources);
    const bob = await knowledgeService.getKnowledgeContext({ neuronId: "b", userId: "bob" });
    assert.ok(bob.sources.every((s) => s.neuronId === "b" && s.subjectId === "subject-b"));
  });
  await t.test("absent MarkdownNote still returns neuron knowledge", async () => {
    const note = notes.get("a");
    notes.delete("a");
    try {
      assert.deepEqual((await knowledgeService.getKnowledgeContext(scope)).sources.map((s) => s.type), ["NEURON"]);
    } finally { notes.set("a", note); }
  });
  await t.test("empty markdown remains an empty source, not a missing source", async () => {
    const note = notes.get("a");
    notes.set("a", { ...note, content: "" });
    try {
      assert.equal((await knowledgeService.getKnowledgeContext(scope)).sources[1].content, "");
    } finally { notes.set("a", note); }
  });
  await t.test("empty and null neuron fields produce no empty headings", async () => {
    const neuron = neurons.get("a");
    neurons.set("a", { ...neuron, textContent: "", note: null, keyPoints: "  ", memoryMethod: "", application: "" });
    try {
      assert.equal((await knowledgeService.getKnowledgeContext(scope)).sources[0].content, "");
    } finally { neurons.set("a", neuron); }
  });
  await t.test("foreign and missing neurons yield the same 404 before any provider runs", async () => {
    const provider = { type: "NEURON", getSources: () => assert.fail("Unauthorized provider invocation") };
    for (const service of [knowledgeService, new KnowledgeService([provider])]) {
      for (const neuronId of ["b", "missing"]) {
        await assert.rejects(service.getKnowledgeContext({ neuronId, userId: "alice" }),
          { status: 404, code: "NEURON_NOT_FOUND" });
        await assert.rejects(service.getKnowledgeSourcesForNeuron({ neuronId, userId: "alice" }),
          { status: 404, code: "NEURON_NOT_FOUND" });
      }
    }
  });
  await t.test("direct provider calls also filter ownership", async () => {
    for (const provider of [new NeuronKnowledgeProvider(), new MarkdownKnowledgeProvider()]) {
      assert.deepEqual(await provider.getSources({ neuronId: "b", userId: "alice" }), []);
      assert.deepEqual(await provider.getSources({ neuronId: "missing", userId: "alice" }), []);
    }
  });
  await t.test("missing auth and invalid neuron IDs fail before Prisma can drop filters", async () => {
    const readers = [
      (s) => knowledgeService.getKnowledgeContext(s),
      (s) => knowledgeService.getKnowledgeSourcesForNeuron(s),
      (s) => new NeuronKnowledgeProvider().getSources(s),
      (s) => new MarkdownKnowledgeProvider().getSources(s),
    ];
    const before = queryCount;
    for (const read of readers) {
      for (const userId of [undefined, null, "", "  ", 123, {}]) {
        await assert.rejects(read({ neuronId: "a", userId }), { status: 401 });
      }
      for (const neuronId of [undefined, null, "", "  ", 123, {}]) {
        await assert.rejects(read({ neuronId, userId: "alice" }), { status: 400 });
      }
    }
    assert.equal(queryCount, before);
  });
  await t.test("DTO allowlist excludes internal metadata; documents are not extracted", async () => {
    const context = await knowledgeService.getKnowledgeContext(scope);
    const serialized = JSON.stringify(context);
    for (const forbidden of ["storageKey", "storagePath", "private-key", "private-path", "secret", "userId", "owner", "JWT", "DATABASE_URL"]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    assert.equal(context.sources.some((source) => source.type === "DOCUMENT"), false);
  });
  await t.test("provider failures propagate instead of silently returning incomplete context", async () => {
    const service = new KnowledgeService([{ type: "MARKDOWN", getSources: async () => { throw new Error("Read failed"); } }]);
    await assert.rejects(service.getKnowledgeContext(scope), /Read failed/);
  });
});
