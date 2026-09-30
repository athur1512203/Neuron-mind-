const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chunkMarkdown } = require('../dist/knowledge/chunking');
const { retrieveContext, selectedKnowledgeContext, serializeRetrievedContext, TOP_K } = require('../dist/knowledge/retrieval');
const { NeuroService } = require('../dist/services/neuro.service');

const fixture = `Nguyễn Minh Anh đang làm việc tại phòng Marketing của công ty Nova.
Minh Anh phụ trách chiến dịch quảng cáo sản phẩm mới trong tháng 10.
Chiến dịch có ngân sách 120 triệu đồng và mục tiêu đạt 5.000 khách hàng tiềm năng.

Cuộc họp dự án Alpha được tổ chức vào 9 giờ sáng thứ Hai.
Nam chịu trách nhiệm chuẩn bị báo cáo doanh thu trước cuộc họp.
Lan phụ trách trình bày kế hoạch marketing.

Kho Hà Nội hiện còn 350 sản phẩm A và 120 sản phẩm B.
Mỗi ngày trung bình bán được 25 sản phẩm A.
Công ty yêu cầu tồn kho sản phẩm A không được thấp hơn 100 sản phẩm.

Dự án website mới phải hoàn thành trước ngày 20/10.
Phần giao diện do Tuấn phụ trách và phần backend do Hùng phụ trách.
Tuấn đã hoàn thành giao diện nhưng backend vẫn đang trong quá trình phát triển.

Khách hàng Hoàng Nam phản ánh đơn hàng DH1025 giao chậm 3 ngày.
Bộ phận chăm sóc khách hàng đã liên hệ xin lỗi và gửi mã giảm giá cho lần mua tiếp theo.`;

const source = (content = fixture, overrides = {}) => ({
  type: 'MARKDOWN', sourceId: 'note-a', neuronId: 'a', subjectId: 'subject-a', title: 'Ghi chú',
  content, updatedAt: '2026-09-30T00:00:00Z',
  provenance: { sourceType: 'MARKDOWN', sourceId: 'note-a', neuronId: 'a', subjectId: 'subject-a' }, ...overrides,
});
const context = (...sources) => ({ neuronId: 'a', subjectId: 'subject-a', sources });
const cases = [
  ['A', 'Ai phụ trách backend?', 'phần backend do Hùng phụ trách'],
  ['B', 'Ai phụ trách phần giao diện?', 'Tuấn phụ trách'],
  ['C', 'Kho Hà Nội còn bao nhiêu sản phẩm A?', '350 sản phẩm A'],
  ['D', 'Cuộc họp Alpha diễn ra khi nào?', '9 giờ sáng thứ Hai'],
  ['E', 'Đơn hàng DH1025 gặp vấn đề gì?', 'giao chậm 3 ngày'],
  ['F', 'Ngân sách chiến dịch của Minh Anh?', '120 triệu đồng'],
];
for (const [label, question, fact] of cases) {
  test(`Recall CASE ${label}: retrieved context, not a generated answer`, () => {
    const result = retrieveContext(context(source()), question);
    assert.ok(result.chunks.some((chunk) => chunk.content.includes(fact)));
    assert.equal('answer' in result, false);
    assert.equal('found' in result, false);
    assert.ok(result.chunks.length <= TOP_K);
    assert.ok(result.chunks.every((chunk) => chunk.sourceType === 'MARKDOWN' && chunk.sourceId === 'note-a'));
  });
}

test('headings keep sections and surrounding paragraphs; plain blocks preserve lines', () => {
  const content = '## Dự án website\r\n\r\nHạn 20/10.\r\nBackend do Hùng phụ trách.\r\n\r\nVẫn đang phát triển.\r\n\r\n## Kho hàng\r\n\r\nKho còn 350 sản phẩm.';
  assert.deepEqual(chunkMarkdown(content), [
    { heading: 'Dự án website', content: 'Hạn 20/10.\nBackend do Hùng phụ trách.\n\nVẫn đang phát triển.' },
    { heading: 'Kho hàng', content: 'Kho còn 350 sản phẩm.' },
  ]);
  assert.equal(chunkMarkdown(fixture).length, 5);
  const selected = retrieveContext(context(source(fixture)), 'Ai phụ trách backend?');
  const website = selected.chunks.find((chunk) => chunk.content.includes('Hùng'));
  assert.ok(website.content.includes('20/10'));
  assert.ok(website.content.includes('quá trình phát triển'));
  assert.equal(chunkMarkdown('## Parent\n### Child\ntext')[0].heading, 'Parent / Child');
  assert.equal(chunkMarkdown('```md\n## Not a heading\n```')[0].heading, '');
});

test('negative questions may retrieve related context, but never assert an answer', async () => {
  for (const question of ['Hùng bao nhiêu tuổi?', 'Website sử dụng React hay Vue?']) {
    const result = retrieveContext(context(source()), question);
    assert.ok(result.chunks.some((chunk) => chunk.content.includes('Hùng')));
    assert.equal('answer' in result, false);
    // Retrieval cannot establish age/framework facts. The provider must judge sufficiency.
    const service = new NeuroService({ getKnowledgeContext: async () => context(source()) }, {
      name: 'mock', generate: async (input) => {
        assert.deepEqual(input.retrievedContext, result);
        return { found: false, answer: null, sources: [], provider: 'mock', model: 'test' };
      },
    });
    assert.deepEqual(await service.ask({ neuronId: 'a', userId: 'alice', message: question }), {
      neuronId: 'a', subjectId: 'subject-a', found: false, answer: null, sources: [],
    });
  }
});

test('dedupe precedes TOP_K; stable order, unique parent sources, both provider types', () => {
  const first = source('backend first\n\nbackend second\n\nbackend third\n\nbackend fourth');
  const neuron = source('backend neuron', { type: 'NEURON', sourceId: 'a' });
  const result = retrieveContext(context(first, first, neuron), 'backend');
  assert.deepEqual(result.chunks.map((chunk) => chunk.content), ['backend first', 'backend second', 'backend third']);
  assert.deepEqual(result, retrieveContext(context(first, neuron), 'backend'));
  assert.equal(selectedKnowledgeContext(result).sources.length, 1);
  const mixed = retrieveContext(context(source('backend markdown'), neuron), 'backend');
  assert.deepEqual(mixed.chunks.map((chunk) => chunk.sourceType), ['MARKDOWN', 'NEURON']);
  assert.equal(selectedKnowledgeContext(mixed).sources.length, 2);
});

test('heading/title matches, Unicode normalization, empty and unrelated context', () => {
  assert.equal(retrieveContext(context(source('## Backend\nHùng phụ trách.')), 'backend').chunks.length, 1);
  assert.equal(retrieveContext(context(source('Hùng phụ trách.', { title: 'Backend' })), 'backend').chunks.length, 1);
  assert.equal(retrieveContext(context(source('Hùng phụ trách.'.normalize('NFD'))), 'HÙNG?').chunks.length, 1);
  for (const input of [context(), context(source('')), context(source(null)), context(source(' \r\n '))]) {
    assert.deepEqual(retrieveContext(input, 'backend').chunks, []);
  }
  assert.deepEqual(retrieveContext(context(source()), 'hãy vui lòng cho tôi biết ai nào mấy').chunks, []);
  assert.deepEqual(retrieveContext(context(source()), 'quantum entanglement').chunks, []);
});

test('provider receives only selected allowlisted content, not documents, secrets or history', async () => {
  const input = context(source('backend do Hùng phụ trách\n\nUNRELATED_PRIVATE_TEXT', { storageKey: 'SECRET_STORAGE', apiKey: 'SECRET_KEY' }),
    source('backend document', { type: 'DOCUMENT', sourceId: 'doc' }));
  const result = retrieveContext(input, 'backend');
  assert.equal(result.chunks.length, 1);
  const serialized = serializeRetrievedContext(result, 'backend');
  assert.match(serialized, /KNOWLEDGE CONTEXT[\s\S]*Type: MARKDOWN[\s\S]*QUESTION:\nbackend/);
  const service = new NeuroService({ getKnowledgeContext: async (scope) => {
    assert.deepEqual(scope, { neuronId: 'a', userId: 'alice' });
    return input;
  } }, { name: 'mock', generate: async (received) => {
    const data = JSON.stringify(received);
    for (const forbidden of ['SECRET_STORAGE', 'SECRET_KEY', 'UNRELATED_PRIVATE_TEXT', 'backend document']) assert.equal(data.includes(forbidden), false);
    assert.deepEqual(received.retrievedContext, result);
    return { found: false, answer: null, sources: [], provider: 'mock', model: 'test' };
  } });
  await service.ask({ neuronId: 'a', userId: 'alice', message: 'backend', history: [{ role: 'user', content: 'UNRELATED_PRIVATE_TEXT' }] });
});
