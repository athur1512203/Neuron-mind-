const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Neuro Chat V0 grounded answers from KnowledgeContext", async (t) => {
  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };

  process.env.JWT_SECRET = "test-only-neuro-chat-secret";
  process.env.AI_PROVIDER = "local";
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

  const opportunityKnowledge = "Chi phí cơ hội là giá trị của phương án tốt nhất bị bỏ qua.";
  const opportunityContext = {
    neuronId: "a",
    subjectId: "subject-a",
    sources: [{
      type: "MARKDOWN", sourceId: "note-opp", neuronId: "a", subjectId: "subject-a", title: "Chi phí",
      content: opportunityKnowledge,
      updatedAt: updatedAt.toISOString(),
      provenance: { sourceType: "MARKDOWN", sourceId: "note-opp", neuronId: "a", subjectId: "subject-a" },
    }],
  };

  const contextFor = (content) => ({ ...opportunityContext,
    sources: [{ ...opportunityContext.sources[0], content }] });
  const people = "quỳnh chi sinh năm 2003\nhải như học lớp 10";
  const companies = "công ty ABC có 25 nhân viên\ncông ty XYZ có doanh thu 2 tỷ";
  const passageCases = [
    ["A", people, "hải như học lớp nào", "hải như học lớp 10"],
    ["B", people, "quỳnh chi sinh năm bao nhiêu", "quỳnh chi sinh năm 2003"],
    ["C", people, "ngọc anh sinh năm bao nhiêu", null],
    ["D", people, "minh anh học lớp nào", null],
    ["E", people, "thời tiết hôm nay thế nào", null],
    ["F", companies, "công ty ABC có bao nhiêu nhân viên", "công ty ABC có 25 nhân viên"],
    ["G", companies, "công ty XYZ có bao nhiêu nhân viên", null],
    ["H", "Nguyễn Văn Minh sinh năm 2001\nTrần Ngọc Lan học lớp 12", "Trần Ngọc Lan học lớp nào", "Trần Ngọc Lan học lớp 12"],
  ];
  for (const [label, content, question, answer] of passageCases) {
    await t.test(`Passage CASE ${label}`, () => {
      const result = answerFromKnowledge(contextFor(content), question,
        [{ role: "user", content: "quỳnh chi sinh năm bao nhiêu" }]);
      assert.deepEqual(result, {
        neuronId: "a", subjectId: "subject-a", found: answer !== null, answer,
        sources: answer === null ? [] : [{ type: "MARKDOWN", sourceId: "note-opp",
          title: "Chi phí", neuronId: "a", subjectId: "subject-a" }],
      });
    });
  }

  await t.test("splitter handles LF, CRLF, CR, whitespace and blank lines", () => {
    const { splitPassages } = require("../dist/knowledge/passages");
    assert.deepEqual(splitPassages(" \r\n first \r second\n\n third \n"), ["first", "second", "third"]);
    assert.deepEqual(splitPassages(" \r\n\t"), []);
    for (const newline of ["\n", "\r\n", "\r"]) {
      assert.equal(answerFromKnowledge(contextFor(people.replace("\n", newline)), "hải như học lớp nào").answer,
        "hải như học lớp 10");
    }
  });

  await t.test("highest score wins across sources; ties retain source then line order", () => {
    const context = contextFor("chi phí của cơ hội là giá trị bỏ qua");
    context.sources.push({ ...context.sources[0], sourceId: "best", content: opportunityKnowledge });
    context.sources.push({ ...context.sources[1] });
    const result = answerFromKnowledge(context, "chi phí cơ hội là gì");
    assert.equal(result.answer, opportunityKnowledge);
    assert.deepEqual(result.sources.map((source) => source.sourceId), ["best"]);
    const tie = contextFor("chi phí cơ hội là phương án bỏ qua\nchi phí cơ hội là giá trị bỏ qua");
    tie.sources.push({ ...tie.sources[0], sourceId: "later" });
    assert.equal(answerFromKnowledge(tie, "chi phí cơ hội").answer, "chi phí cơ hội là phương án bỏ qua");
    assert.equal(answerFromKnowledge(tie, "chi phí cơ hội").sources[0].sourceId, "note-opp");
  });

  await t.test("no pooling across sources or generic school-class matches", () => {
    const context = contextFor("công ty ABC có 25 nhân viên");
    context.sources.push({ ...context.sources[0], sourceId: "other", content: "công ty XYZ có doanh thu 2 tỷ" });
    assert.equal(answerFromKnowledge(context, "công ty XYZ có bao nhiêu nhân viên").found, false);
    assert.equal(answerFromKnowledge(contextFor(people), "học lớp nào").found, false);
  });
  const cases = [
    ["A", "quỳnh chi sinh năm 2003", "quỳnh chi sinh năm bao nhiêu", true],
    ["B", "quỳnh chi sinh năm 2003", "ngọc anh sinh năm bao nhiêu", false],
    ["C", "nguyễn văn minh sinh năm 2001", "trần ngọc lan sinh năm bao nhiêu", false],
    ["D", "công ty ABC có 25 nhân viên", "công ty ABC có bao nhiêu nhân viên", true],
    ["E", "công ty ABC có 25 nhân viên", "công ty XYZ có bao nhiêu nhân viên", false],
    ["F", "công ty ABC bán sách", "công ty này có bao nhiêu nhân viên", false],
    ["G", opportunityKnowledge, "thời tiết hôm nay thế nào", false],
    ["H", "quỳnh chi sinh năm 2003", "ngọc anh sinh năm bao nhiêu", false],
  ];
  for (const [label, content, question, found] of cases) {
    await t.test(`CASE ${label}: distinctive relevance`, async () => {
      const context = contextFor(content);
      const { NeuroService } = require("../dist/services/neuro.service");
      let knowledgeCalls = 0;
      const service = new NeuroService({ getKnowledgeContext: async () => {
        knowledgeCalls++;
        return context;
      } });
      const result = await service.ask({ neuronId: "a", userId: "alice", message: question,
        history: label === "H" ? [{ role: "user", content: "quỳnh chi" }] : [] });
      assert.equal(knowledgeCalls, 1);
      assert.equal(result.found, found);
      if (found) {
        assert.equal(result.answer, content);
        assert.deepEqual(result.sources.map((source) => source.sourceId), ["note-opp"]);
      } else {
        assert.deepEqual(result, { neuronId: "a", subjectId: "subject-a",
          found: false, answer: null, sources: [] });
      }
    });
  }

  await t.test("Unicode, punctuation, case and single-character identifiers", () => {
    const result = answerFromKnowledge(contextFor("Quỳnh Chi sinh năm 2003".normalize("NFD")),
      "  QUỲNH,  CHI sinh năm bao nhiêu? ");
    assert.equal(result.found, true);
    assert.equal(answerFromKnowledge(contextFor("sản phẩm X giá 25"), "sản phẩm X giá bao nhiêu").found, true);
  });

  await t.test("partial identities, generic-only questions and absent attributes miss", () => {
    for (const question of ["quỳnh anh sinh năm bao nhiêu", "sinh năm bao nhiêu", "cho tôi biết là gì"]) {
      assert.equal(answerFromKnowledge(contextFor("quỳnh chi sinh năm 2003"), question).found, false);
    }
    assert.equal(answerFromKnowledge(contextFor("công ty ABC bán sách"), "công ty ABC có bao nhiêu nhân viên").found, false);
    assert.equal(answerFromKnowledge(contextFor("dự án Alpha ra mắt tháng 5"), "dự án Beta ra mắt khi nào").found, false);
  });

  await t.test("duplicate provider passages appear once and citations have stable identities", () => {
    const content = "quỳnh chi sinh năm 2003";
    const context = contextFor(`## Text\n${content}\n\n## Note\n${content}`);
    context.sources.push({ ...context.sources[0], type: "NEURON", sourceId: "a", content });
    context.sources.push({ ...context.sources[0] });
    const result = answerFromKnowledge(context, "quỳnh chi sinh năm bao nhiêu");
    assert.equal(result.answer.split(content).length - 1, 1);
    assert.equal(result.sources.length, 1);
    const multiple = answerFromKnowledge(contextFor(`${content}\n\nquỳnh chi sinh năm 2003 tại Hà Nội`), "quỳnh chi sinh năm bao nhiêu");
    assert.equal(multiple.sources.length, 1);
    assert.equal(multiple.answer, content);
  });

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
    assert.equal(result.found, true);
    assert.match(result.answer, /Lập ngân sách tháng/);
    assert.deepEqual(result.sources, [{
      type: "NEURON", sourceId: "a", title: "Thu nhập", neuronId: "a", subjectId: "subject-a",
    }]);
  });

  await t.test("chi phí cơ hội queries still retrieve the markdown definition", () => {
    for (const question of ["chi phí cơ hội là gì", "chi phí cơ hội", "cơ hội là gì"]) {
      const result = answerFromKnowledge(opportunityContext, question);
      assert.equal(result.found, true, question);
      assert.equal(result.answer, opportunityKnowledge);
      assert.deepEqual(result.sources.map((item) => item.sourceId), ["note-opp"]);
    }
  });

  await t.test("unrelated employee-count query does not fall back to existing knowledge", () => {
    const result = answerFromKnowledge(
      opportunityContext,
      "công ty này có bao nhiêu nhân viên",
      [{ role: "user", content: "chi phí cơ hội là gì" }, { role: "assistant", content: opportunityKnowledge }],
    );
    assert.equal(result.found, false);
    assert.equal(result.answer, null);
    assert.deepEqual(result.sources, []);
    assert.equal(JSON.stringify(result).includes("Chi phí cơ hội"), false);
  });

  await t.test("other unrelated queries also miss without quoting knowledge", () => {
    for (const question of ["quantum entanglement", "thời tiết hôm nay như thế nào"]) {
      const result = answerFromKnowledge(opportunityContext, question);
      assert.equal(result.found, false, question);
      assert.equal(result.answer, null);
      assert.deepEqual(result.sources, []);
      assert.equal(String(result.answer ?? "").includes("Chi phí cơ hội"), false);
    }
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
      assert.equal(body.found, true);
      assert.match(body.answer, /nhu cầu và tiết kiệm/);
      assert.ok(body.sources.some((item) => item.type === "MARKDOWN" && item.sourceId === "note-a"));
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
