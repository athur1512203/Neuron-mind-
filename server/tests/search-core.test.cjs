const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Search Core hierarchy and independent backend execution', async (t) => {
  // No React, NeuroService or AIProvider is needed to call this engine.
  const { SearchCore } = require('../dist/search/core');
  for (const loaded of Object.keys(require.cache)) {
    assert.equal(/[/\\](neuro\.service|local-answer|mock\.provider|openai\.provider)\.js$/.test(loaded), false);
  }
  const { prisma } = require('../dist/lib/prisma');
  const storage = require('../dist/storage');
  t.mock.method(storage, 'getStorageProvider', () => assert.fail('No R2/binary access'));
  t.mock.method(globalThis, 'fetch', () => assert.fail('No AI/network calls'));
  const now = new Date('2026-09-30T00:00:00Z');
  const spaces = [
    { id: 'nova', name: 'Công ty Nova', userId: 'alice', neurons: [] },
    { id: 'personal', name: 'Personal', userId: 'alice', neurons: [] },
    { id: 'foreign', name: 'Công ty Nova', userId: 'bob', neurons: [] },
  ];
  const neurons = [];
  const notes = [];
  const documents = [];
  const add = (id, name, space, content, file) => {
    const neuron = { id, name, subjectId: space.id, subject: space, textContent: `${name} overview`, note: '',
      keyPoints: '', memoryMethod: '', application: '', updatedAt: now, documents: [], markdownNote: null };
    const note = { id: `md-${id}`, neuronId: id, neuron, content, updatedAt: now };
    const doc = { id: `doc-${id}`, subjectId: space.id, subject: space, originalName: file, storedName: `stored-${id}`,
      mimeType: 'application/octet-stream', extension: '.docx', checksum: 'abc', size: 1024,
      storageKey: 'SECRET_KEY', storagePath: 'SECRET_PATH', passwordHash: 'SECRET_HASH', updatedAt: now };
    neuron.markdownNote = note; space.documents ??= []; space.documents.push(doc); space.neurons.push(neuron);
    neurons.push(neuron); notes.push(note); documents.push(doc);
  };
  const website = 'Phần giao diện do Tuấn phụ trách và phần backend do Hùng phụ trách.\nTuấn đã hoàn thành giao diện nhưng backend vẫn đang trong quá trình phát triển.\nDự án website mới phải hoàn thành trước ngày 20/10.';
  add('website', 'Website', spaces[0], website, 'website-plan.docx');
  add('marketing', 'Marketing', spaces[0], 'Minh Anh phụ trách chiến dịch quảng cáo sản phẩm mới trong tháng 10.\nChiến dịch có ngân sách 120 triệu đồng.', 'marketing-budget.xlsx');
  add('warehouse', 'Kho hàng', spaces[0], 'Kho Hà Nội hiện còn 350 sản phẩm A.', 'inventory.xlsx');
  add('personal-site', 'Website', spaces[1], 'Personal website', 'personal.docx');
  add('bob-site', 'Website', spaces[2], 'BOB_PRIVATE website backend', 'bob-secret.docx');

  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some((entry) => matches(row, entry));
      if (key === 'AND') return value.every((entry) => matches(row, entry));
      if (value && typeof value === 'object') {
        if ('contains' in value) return String(row?.[key] ?? '').toLowerCase().includes(value.contains.toLowerCase());
        if ('in' in value) return value.in.includes(row?.[key]);
        if ('some' in value) return (row?.[key] ?? []).some((entry) => matches(entry, value.some));
        if ('is' in value) return row?.[key] != null && matches(row[key], value.is);
        return row?.[key] != null && matches(row[key], value);
      }
      return row?.[key] === value;
    });
  }
  const calls = [];
  for (const [type, rows] of [['subject', spaces], ['neuron', neurons], ['markdownNote', notes], ['document', documents]]) {
    const original = prisma[type].findMany;
    t.after(() => { prisma[type].findMany = original; });
    prisma[type].findMany = async (args) => {
      calls.push({ type, ...args });
      assert.ok(args.take > 0 && args.take <= 500);
      const serialized = JSON.stringify(args.where);
      assert.ok(serialized.includes('userId'), `${type} missing ownership predicate`);
      if (type === 'document') {
        for (const field of ['storageKey', 'storagePath', 'passwordHash', 'storedName', 'checksum']) {
          assert.equal(args.select[field], undefined);
        }
      }
      const sorted = rows.filter((row) => matches(row, args.where)).sort((a, b) => a.id.localeCompare(b.id));
      const start = args.cursor ? sorted.findIndex((row) => row.id === args.cursor.id) + args.skip : 0;
      return sorted.slice(start, start + args.take);
    };
  }
  const core = new SearchCore();
  const plan = (extra = {}) => ({ userId: 'alice', space: { query: 'Nova' }, neuron: { query: 'Website' },
    requests: [{ id: 'progress', query: 'backend', sources: ['MARKDOWN'] }], ...extra });

  await t.test('Space-only exact, normalized and keyword queries load metadata only', async () => {
    for (const query of ['Công ty Nova', 'CÔNG--TY NOVA', 'Nova', 'Công ty Nova'.normalize('NFD')]) {
      const before = calls.length;
      const result = await core.execute(plan({ space: { query }, neuron: undefined, requests: [] }));
      assert.deepEqual(result.plan, { resolvedSpaceIds: ['nova'], resolvedNeuronIds: [] });
      assert.deepEqual(result.requests, []);
      assert.deepEqual(result.sources, []);
      assert.ok(calls.slice(before).every((call) => call.type === 'subject' && !call.select.neurons));
    }
  });
  await t.test('scope-only Neuron resolution disambiguates identical names by Space', async () => {
    const before = calls.length;
    const result = await core.execute(plan({ space: { id: 'personal' }, requests: [] }));
    assert.deepEqual(result.plan, { resolvedSpaceIds: ['personal'], resolvedNeuronIds: ['personal-site'] });
    assert.ok(calls.slice(before).every((call) => !['markdownNote', 'document'].includes(call.type)));
    assert.deepEqual(calls.at(-1).where.subjectId, { in: ['personal'] });
  });
  await t.test('exact IDs override stale names and enforce ownership without content/name resolution', async () => {
    const before = calls.length;
    const result = await core.execute(plan({ space: { id: 'nova', query: 'wrong' }, neuron: { id: 'website', query: 'wrong' }, requests: [] }));
    assert.deepEqual(result.plan, { resolvedSpaceIds: ['nova'], resolvedNeuronIds: ['website'] });
    for (const call of calls.slice(before)) {
      assert.equal(call.where.name, undefined);
      assert.equal(call.where.OR, undefined);
    }
    const neuronOnly = await core.execute(plan({ space: undefined, neuron: { id: 'personal-site' }, requests: [] }));
    assert.deepEqual(neuronOnly.plan, { resolvedSpaceIds: ['personal'], resolvedNeuronIds: ['personal-site'] });
    await assert.rejects(core.execute(plan({ space: undefined, neuron: { id: 'bob-site' }, requests: [] })), { status: 404 });
  });
  await t.test('unmatched Space or Neuron returns empty results without content queries', async () => {
    for (const extra of [{ space: { query: 'unmatched' } }, { neuron: { query: 'unmatched' } }]) {
      const before = calls.length;
      const result = await core.execute(plan(extra));
      assert.deepEqual(result.plan.resolvedNeuronIds, []);
      assert.deepEqual(result.requests[0].results, []);
      assert.ok(calls.slice(before).every((call) => !['markdownNote', 'document'].includes(call.type)));
    }
  });
  await t.test('foreign-only names and Markdown cannot become resolution candidates', async () => {
    const foreignSpace = spaces[2], foreignNeuron = neurons.find((row) => row.id === 'bob-site');
    const previousSpace = foreignSpace.name, previousNeuron = foreignNeuron.name;
    foreignSpace.name = 'Private Space';
    foreignNeuron.name = 'Private Neuron';
    try {
      const space = await core.execute(plan({ space: { query: 'Private Space' }, neuron: undefined, requests: [] }));
      assert.deepEqual(space.plan.resolvedSpaceIds, []);
      const neuron = await core.execute(plan({ space: undefined, neuron: { query: 'Private Neuron' }, requests: [] }));
      assert.deepEqual(neuron.plan.resolvedNeuronIds, []);
      const markdown = await core.execute(plan({ space: undefined, neuron: undefined,
        requests: [{ id: 'private', query: 'BOB_PRIVATE', sources: ['MARKDOWN'] }] }));
      assert.deepEqual(markdown.requests[0].results, []);
    } finally {
      foreignSpace.name = previousSpace;
      foreignNeuron.name = previousNeuron;
    }
  });
  await t.test('name priority precedes maxSpaces/maxNeurons, including metadata pagination', async () => {
    const extraSpaces = Array.from({ length: 501 }, (_, i) => ({ id: `a-${String(i).padStart(3, '0')}`, name: 'Nova archive', userId: 'alice', neurons: [] }));
    extraSpaces.push({ id: 'y-normalized', name: 'NOVA', userId: 'alice', neurons: [] },
      { id: 'z-exact', name: 'Nova', userId: 'alice', neurons: [] });
    spaces.push(...extraSpaces);
    const extraNeurons = [
      { id: 'a-prefix', name: 'Website archive', subjectId: 'nova', subject: spaces[0] },
      { id: 'b-normalized', name: 'WEBSITE', subjectId: 'nova', subject: spaces[0] },
    ];
    neurons.push(...extraNeurons);
    try {
      const result = await core.execute(plan({ space: { query: 'Nova' }, neuron: undefined, requests: [], options: { maxSpaces: 2 } }));
      assert.deepEqual(result.plan.resolvedSpaceIds, ['z-exact', 'y-normalized']);
      const selected = await core.execute(plan({ space: { id: 'nova' }, requests: [], options: { maxNeurons: 2 } }));
      assert.deepEqual(selected.plan.resolvedNeuronIds, ['website', 'b-normalized']);
    } finally {
      spaces.splice(-extraSpaces.length);
      neurons.splice(-extraNeurons.length);
    }
  });
  await t.test('content queries contain only selected Neuron IDs and owned Space IDs', async () => {
    const before = calls.length;
    const result = await core.execute(plan({ requests: [{ id: 'content', query: 'overview backend', sources: ['NEURON', 'MARKDOWN'] }] }));
    assert.ok(result.requests[0].results.some((item) => item.sourceType === 'NEURON'));
    assert.ok(result.requests[0].results.some((item) => item.sourceType === 'MARKDOWN'));
    const loads = calls.slice(before).filter((call) => call.select.content || call.select.textContent);
    assert.equal(loads.length, 2);
    for (const call of loads) {
      const where = call.type === 'markdownNote' ? call.where.neuron : call.where;
      assert.deepEqual(where.id.in, ['website']);
      assert.deepEqual(where.subjectId.in, ['nova']);
      assert.equal(where.subject.userId, 'alice');
    }
  });

  await t.test('A/B/C: resolve owned space ID/query and neuron inside it', async () => {
    for (const space of [{ id: 'nova' }, { query: 'Nova' }]) {
      const result = await core.execute(plan({ space }));
      assert.deepEqual(result.plan, { resolvedSpaceIds: ['nova'], resolvedNeuronIds: ['website'] });
    }
  });
  await t.test('D/Q/R/S: guessed foreign scope IDs never expose data', async () => {
    for (const extra of [{ space: { id: 'foreign' } }, { neuron: { id: 'bob-site' } },
      { space: { id: 'nova' }, neuron: { id: 'personal-site' } }]) {
      await assert.rejects(core.execute(plan(extra)), { status: 404 });
    }
    await assert.rejects(core.execute(plan({ userId: ' ' })), { status: 401 });
    const result = await core.execute(plan({ space: undefined, neuron: undefined }));
    assert.equal(JSON.stringify(result).includes('BOB_PRIVATE'), false);
    assert.equal(JSON.stringify(result).includes('bob-site'), false);
  });
  await t.test('E: safe neuron fields retrieved with original provenance', async () => {
    const result = await core.execute(plan({ requests: [{ id: 'n', query: 'overview', sources: ['NEURON'] }] }));
    assert.equal(result.requests[0].results[0].content, 'Website overview');
    assert.deepEqual(result.requests[0].results[0].provenance, { sourceType: 'NEURON', sourceId: 'website', subjectId: 'nova', neuronId: 'website' });
  });
  await t.test('F/K: Markdown context retains neighboring facts', async () => {
    const result = await core.execute(plan());
    assert.equal(result.requests[0].results[0].content, website);
    const marketing = await core.execute(plan({ neuron: { query: 'Marketing' }, requests: [{ id: 'budget', query: 'Minh Anh' }] }));
    assert.ok(marketing.requests[0].results.some((item) => item.content.includes('120 triệu')));
  });
  await t.test('G/T/Y/Z: documents are metadata only, no private fields', async () => {
    const result = await core.execute(plan({ requests: [{ id: 'docs', query: 'website', sources: ['DOCUMENT'] }] }));
    const item = result.requests[0].results[0];
    assert.equal(item.title, 'website-plan.docx');
    assert.equal(item.metadata.fileSize, 1024);
    for (const secret of ['SECRET_', 'storageKey', 'storagePath', 'passwordHash', 'stored-website']) assert.equal(JSON.stringify(result).includes(secret), false);
  });
  await t.test('H/I/J: manual multi-request plan returns grouped data, not an answer', async () => {
    const result = await core.execute(plan({ requests: [
      { id: 'progress', query: 'backend phát triển' }, { id: 'responsibility', query: 'phụ trách' },
      { id: 'deadline', query: '20/10' }, { id: 'documents', query: 'website', sources: ['DOCUMENT'] },
      { id: 'missing', query: 'quantum entanglement', purpose: 'Invent deadline website' },
    ] }));
    assert.deepEqual(result.requests.map((request) => request.requestId), ['progress', 'responsibility', 'deadline', 'documents', 'missing']);
    assert.ok(result.requests.slice(0, 4).every((request) => request.found));
    assert.deepEqual(result.requests[4], { requestId: 'missing', query: 'quantum entanglement', found: false, results: [] });
    assert.equal('answer' in result, false);
    const ids = result.requests.slice(0, 3).map((request) => request.results.find((item) => item.sourceType === 'MARKDOWN').id);
    assert.equal(new Set(ids).size, 1);
    assert.equal(result.sources.filter((source) => source.sourceId === 'md-website').length, 1);
  });
  await t.test('L/M: duplicate chunks deduped and identical plans stable', async () => {
    const note = notes.find((entry) => entry.neuronId === 'website');
    const original = note.content;
    note.content = `${original}\n\n${original}`;
    try {
      const first = await core.execute(plan());
      assert.equal(first.requests[0].results.length, 1);
      assert.deepEqual(first, await core.execute(plan()));
    } finally { note.content = original; }
  });
  await t.test('N: bounds and malformed requests fail before repository access', async () => {
    const before = calls.length;
    for (const extra of [ { space: undefined, neuron: undefined, requests: [] }, { requests: Array.from({ length: 11 }, (_, i) => ({ id: String(i), query: 'backend' })) },
      { requests: [{ id: 'x', query: 'x'.repeat(4001) }] }, { requests: [{ id: 'x', query: 'a' }, { id: 'x', query: 'b' }] },
      { options: { maxResultsPerRequest: 51 } }, { options: { maxSpaces: 101 } }, { options: { maxNeurons: 501 } },
      { options: { includeRelatedNeurons: true } }, { space: { id: ' ' } } ]) {
      await assert.rejects(core.execute(plan(extra)), { status: 400 });
    }
    assert.equal(calls.length, before);
    const empty = await core.execute(plan({ requests: [{ id: 'empty', query: '  ' }] }));
    assert.equal(empty.requests[0].found, false);
    assert.deepEqual(empty.plan.resolvedNeuronIds, ['website']);
    assert.ok(calls.slice(before).every((call) => ['subject', 'neuron'].includes(call.type)));
    const limited = await core.execute(plan({ neuron: undefined, requests: [{ id: 'all', query: 'phụ trách' }], options: { maxResultsPerRequest: 1, maxNeurons: 1, maxSpaces: 1 } }));
    assert.ok(limited.plan.resolvedNeuronIds.length <= 1);
    assert.ok(limited.plan.resolvedSpaceIds.length <= 1);
    assert.ok(limited.requests[0].results.length <= 1);
  });
  await t.test('O/P: exact neuron and space scope restrict all source types', async () => {
    const result = await core.execute(plan({ neuron: { id: 'marketing' }, requests: [{ id: 'all', query: 'marketing' }] }));
    assert.deepEqual(result.plan.resolvedNeuronIds, ['marketing']);
    assert.ok(result.requests[0].results.every((item) => item.subjectId === 'nova' &&
      (item.sourceType === 'DOCUMENT' ? item.neuronId === undefined : item.neuronId === 'marketing')));
  });
  await t.test('candidate loading stays inside resolved IDs and PostgreSQL narrows content', () => {
    const loads = calls.filter((call) => call.type === 'document' || call.type === 'markdownNote');
    assert.ok(loads.length);
    for (const call of loads) {
      if (call.type === 'document') assert.ok(call.where.subjectId.in.length > 0);
      else {
        assert.ok(call.where.neuron.id.in.length > 0);
        assert.ok(call.where.neuron.subjectId.in.length > 0);
      }
      assert.ok(call.where.OR || call.where.content);
      assert.ok(call.take <= 50);
    }
  });
});
