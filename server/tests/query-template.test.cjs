const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRetrievalTemplate, extractKnownTerms } = require('../dist/knowledge/query');
const { retrieveContext } = require('../dist/knowledge/retrieval');

const cases = [
  ['Phần nào của website chưa hoàn thành?', 'Phần ... website chưa hoàn thành', ['phần', 'website', 'chưa', 'hoàn', 'thành'], 'Phần backend của website chưa hoàn thành.'],
  ['Ai phụ trách backend?', '... phụ trách backend', ['phụ', 'trách', 'backend'], 'Phần backend do Hùng phụ trách.'],
  ['Kho Hà Nội còn bao nhiêu sản phẩm A?', 'Kho Hà Nội còn ... sản phẩm A', ['kho', 'hà', 'nội', 'còn', 'sản', 'phẩm', 'a'], 'Kho Hà Nội còn 350 sản phẩm A.'],
  ['Cuộc họp Alpha diễn ra khi nào?', 'Cuộc họp Alpha diễn ra ...', ['cuộc', 'họp', 'alpha', 'diễn', 'ra'], 'Cuộc họp Alpha diễn ra vào 9 giờ sáng thứ Hai.'],
  ['Đơn DH1025 gặp vấn đề gì?', 'Đơn DH1025 gặp vấn đề ...', ['đơn', 'dh1025', 'gặp', 'vấn', 'đề'], 'Đơn DH1025 gặp vấn đề giao chậm 3 ngày.'],
  ['Mục tiêu chiến dịch là bao nhiêu khách hàng?', 'Mục tiêu chiến dịch là ... khách hàng', ['mục', 'tiêu', 'chiến', 'dịch', 'là', 'khách', 'hàng'], 'Mục tiêu chiến dịch là 5.000 khách hàng.'],
];
function context(content) {
  return { neuronId: 'a', subjectId: 's', sources: [{ type: 'MARKDOWN', sourceId: 'note', neuronId: 'a', subjectId: 's',
    title: 'Ghi chú', content, updatedAt: '', provenance: { sourceType: 'MARKDOWN', sourceId: 'note', neuronId: 'a', subjectId: 's' } }] };
}
for (const [question, template, knownTerms, fact] of cases) {
  test(`template and retrieval: ${question}`, () => {
    assert.deepEqual(buildRetrievalTemplate(question), { original: question, template, knownTerms });
    const input = context(cases.map((item) => item[3]).join('\n\n'));
    const before = JSON.stringify(input);
    const result = retrieveContext(input, question);
    assert.equal(result.chunks[0].content, fact);
    assert.equal(result.chunks[0].sourceId, 'note');
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(result, retrieveContext(input, question));
  });
}

test('wildcard is not scored and cannot retrieve arbitrary content', () => {
  assert.deepEqual(extractKnownTerms('...'), []);
  for (const question of ['Ai?', 'Bao nhiêu?', '...', 'Ai phụ trách quantum?']) {
    assert.deepEqual(retrieveContext(context('Kho còn 350 sản phẩm.'), question).chunks, []);
  }
  // An unknown slot does not turn separated terms into an exact phrase bonus.
  const result = retrieveContext(context('kho hàng'), 'Kho bao nhiêu hàng?');
  assert.equal(result.chunks[0].score, 2);
});

test('ambiguous/unrecognized spans use legacy normalization without inventing a slot', () => {
  for (const question of ['Ai phụ trách khi nào?', 'Không ai phụ trách backend', 'Backend làm việc với ai đó', 'Website sử dụng React hay Vue?', '"Ai" là tên mục']) {
    const query = buildRetrievalTemplate(question);
    assert.equal(query.original, question);
    assert.equal(query.template.includes('...'), false);
  }
  assert.deepEqual(buildRetrievalTemplate('Ngân sách chiến dịch của Minh Anh?').knownTerms,
    ['ngân', 'sách', 'chiến', 'dịch', 'minh', 'anh']);
});

test('Unicode and spacing normalize without changing original question', () => {
  const original = '  AI   phụ trách backend?! '.normalize('NFD');
  assert.deepEqual(buildRetrievalTemplate(original), {
    original, template: '... phụ trách backend', knownTerms: ['phụ', 'trách', 'backend'],
  });
});

test('AIProvider receives original question, never the retrieval template', async () => {
  const original = '  Ai phụ trách backend?  ';
  const retrieved = retrieveContext(context('Backend do Hùng phụ trách.'), original);
  let calls = 0;
  await ({
    generate: async (input) => {
      calls++;
      assert.equal(input.question, original);
      assert.equal(input.retrievedContext.chunks.length, 1);
      return { found: false, answer: null, sources: [], provider: 'mock', model: 'test' };
    },
  }).generate({ question: original, retrievedContext: retrieved });
  assert.equal(calls, 1);
});
