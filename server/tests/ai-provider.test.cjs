const { test } = require("node:test");
const assert = require("node:assert/strict");

test("AI provider foundation without network calls", async (t) => {
  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };

  process.env.AI_PROVIDER = "local";
  const { MockAIProvider } = require("../dist/ai/mock.provider");
  const { OpenAIProvider } = require("../dist/ai/openai.provider");
  const { readAIProviderName } = require("../dist/ai/config");
  const { resolveAIProvider } = require("../dist/ai/resolve");
  const { retrieveContext, selectedKnowledgeContext } = require("../dist/knowledge/retrieval");
  const { knowledgeService } = require("../dist/services/knowledge.service");
  const { prisma } = require("../dist/lib/prisma");

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("AI foundation tests must not make network requests");
  t.after(() => {
    globalThis.fetch = previousFetch;
    process.env.AI_PROVIDER = "local";
  });

  const context = {
    neuronId: "a",
    subjectId: "subject-a",
    sources: [{
      type: "MARKDOWN",
      sourceId: "note-a",
      neuronId: "a",
      subjectId: "subject-a",
      title: "Thu nhập",
      content: "Cách nhớ: chia thu nhập thành nhu cầu và tiết kiệm.",
      updatedAt: "2026-09-29T00:00:00.000Z",
      provenance: { sourceType: "MARKDOWN", sourceId: "note-a", neuronId: "a", subjectId: "subject-a" },
    }],
  };

  await t.test("MockAIProvider is deterministic from question and knowledge context", async () => {
    const provider = new MockAIProvider();
    const question = "chi phí cơ hội là gì";
    const first = await provider.generate({ question, context });
    const second = await provider.generate({ question, context });
    assert.equal(first.provider, "mock");
    assert.equal(first.model, "mock-v0");
    assert.equal(first.found, true);
    assert.equal(first.answer, "mock:chi phí cơ hội là gì");
    assert.deepEqual(first.sources, [{
      type: "MARKDOWN", sourceId: "note-a", title: "Thu nhập", neuronId: "a", subjectId: "subject-a",
    }]);
    assert.deepEqual(second, first);
    const serialized = JSON.stringify(first);
    for (const secret of ["OPENAI_API_KEY", "storageKey", "storagePath", "JWT"]) {
      assert.equal(serialized.includes(secret), false);
    }
  });

  await t.test("AIProvider generate receives retrieved context through the abstraction", async () => {
    const calls = [];
    const stub = {
      name: "mock",
      async generate(input) {
        calls.push(input);
        return {
          found: true,
          answer: "from-provider",
          sources: [{ type: "MARKDOWN", sourceId: "note-a", title: "Thu nhập", neuronId: "a", subjectId: "subject-a" }],
          provider: "mock",
          model: "mock-v0",
        };
      },
    };
    const retrieved = retrieveContext(context, "thu nhập là gì");
    const result = await stub.generate({
      question: "thu nhập là gì",
      context: selectedKnowledgeContext(retrieved),
      retrievedContext: retrieved,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].question, "thu nhập là gì");
    assert.equal(calls[0].context.neuronId, "a");
    assert.equal(calls[0].retrievedContext.chunks.length, 1);
    assert.deepEqual(calls[0].context.sources.map((source) => source.sourceId), ["note-a"]);
    assert.equal(result.found, true);
    assert.equal(result.answer, "from-provider");
    assert.equal(result.sources[0].sourceId, "note-a");
  });

  await t.test("missing AI_PROVIDER and openai stay on local retrieval", () => {
    assert.equal(readAIProviderName({}), "local");
    assert.equal(readAIProviderName({ AI_PROVIDER: " " }), "local");
    assert.equal(readAIProviderName({ AI_PROVIDER: "openai" }), "openai");
    assert.equal(resolveAIProvider({}), null);
    assert.equal(resolveAIProvider({ AI_PROVIDER: "openai" }), null);
    assert.equal(resolveAIProvider({ AI_PROVIDER: "mock" }).name, "mock");
  });

  await t.test("OpenAI boundary does not call the network", async () => {
    const provider = new OpenAIProvider();
    await assert.rejects(() => provider.generate({ question: "hello", context }), {
      code: "OPENAI_PROVIDER_NOT_ENABLED",
    });
  });

  const updatedAt = new Date("2026-09-29T00:00:00Z");
  const neurons = new Map([
    ["a", { id: "a", subjectId: "subject-a", owner: "alice", name: "Thu nhập",
      textContent: "Thu nhập là tiền nhận được từ công việc.", note: null, keyPoints: "",
      memoryMethod: "", application: "", updatedAt, images: [], audio: [] }],
    ["b", { id: "b", subjectId: "subject-b", owner: "bob", name: "Private",
      textContent: "Bí mật của Bob", note: null, keyPoints: "", memoryMethod: "", application: "", updatedAt, images: [], audio: [] }],
  ]);
  mockPrisma(prisma.neuron, "findFirst", async ({ where }) => {
    const neuron = neurons.get(where.id);
    return neuron?.owner === where.subject.userId ? neuron : null;
  });
  mockPrisma(prisma.markdownNote, "findFirst", async () => null);

  await t.test("foreign neuron never reaches other-user knowledge", async () => {
    await assert.rejects(
      knowledgeService.getKnowledgeContext({ neuronId: "b", userId: "alice" }),
      { status: 404, code: "NEURON_NOT_FOUND" },
    );
    const allowed = await knowledgeService.getKnowledgeContext({ neuronId: "a", userId: "alice" });
    assert.ok(allowed.sources.every((source) => source.neuronId === "a"));
    assert.equal(JSON.stringify(allowed).includes("Bí mật của Bob"), false);
  });
});
