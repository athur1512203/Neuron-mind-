const { test } = require('node:test');
const assert = require('node:assert/strict');

const empty = { plan: { resolvedSpaceIds: ['s1'], resolvedNeuronIds: [] }, requests: [], sources: [] };
const final = (answer = 'Answer') => ({ status: 'completed', output: [], output_text: answer });
const call = (args, id = 'call-1', name = 'search_memory') => ({ status: 'completed', output_text: '',
  output: [{ type: 'function_call', name, call_id: id, arguments: typeof args === 'string' ? args : JSON.stringify(args) }] });
const scopeArgs = { space: { query: 'Work' }, requests: [] };

test('AI Manager: bounded stateless Responses tool loop', async (t) => {
  const { AIManager, MAX_TOOL_ROUNDS } = require('../dist/ai/manager');
  const { searchMemoryTool, toSearchPlan, compactSearchResult } = require('../dist/ai/search-tool');
  const { AppError } = require('../dist/utils/app-error');
  const { SearchCore } = require('../dist/search/core');
  const OpenAI = require('openai').default;
  const previous = { key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL };
  process.env.OPENAI_API_KEY = 'test-key'; process.env.OPENAI_MODEL = 'test-model';
  t.after(() => {
    for (const [key, value] of [['OPENAI_API_KEY', previous.key], ['OPENAI_MODEL', previous.model]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  t.mock.method(globalThis, 'fetch', () => assert.fail('No external API requests allowed'));
  const noSearch = { execute: async () => assert.fail('Unexpected Search') };

  await t.test('general questions answer without Search and requests carry no stored conversation', async () => {
    let count = 0;
    const manager = new AIManager(async (request) => {
      count++;
      assert.equal(request.model, 'test-model'); assert.equal(request.store, false);
      assert.equal(request.input.length, 1); assert.equal(request.parallel_tool_calls, false);
      assert.deepEqual(request.tools, [searchMemoryTool]);
      return final();
    }, noSearch);
    assert.deepEqual(await manager.chat('alice', 'Hello'), { answer: 'Answer' });
    await manager.chat('bob', 'Hello'); assert.equal(count, 2);
  });

  await t.test('Space → Neuron → content calls reuse IDs through the real SearchCore', async () => {
    const plans = [], loads = [];
    const source = { type: 'MARKDOWN', sourceId: 'md1', subjectId: 's1', neuronId: 'n1',
      title: 'NeuroMind', content: 'Backend progress is good.', updatedAt: '2026-10-05T00:00:00Z',
      provenance: { sourceType: 'MARKDOWN', sourceId: 'md1', subjectId: 's1', neuronId: 'n1' } };
    const core = new SearchCore({
      resolve: async (plan) => { plans.push(plan); return { spaceIds: ['s1'], neuronIds: plan.neuron ? ['n1'] : [] }; },
      load: async (plan, scope) => { loads.push(scope); return [source]; },
    });
    const steps = [scopeArgs, { space: { id: 's1' }, neuron: { query: 'NeuroMind' }, requests: [] },
      { space: { id: 's1' }, neuron: { id: 'n1' }, requests: [{ id: 'progress', query: 'progress' }] }];
    let round = 0;
    const manager = new AIManager(async (request) => {
      if (round) {
        const output = request.input.filter((item) => item.type === 'function_call_output').at(-1);
        assert.equal(output.call_id, `call-${round - 1}`);
        const parsed = JSON.parse(output.output);
        assert.deepEqual(parsed.spaceIds, ['s1']);
        if (round > 1) assert.deepEqual(parsed.neuronIds, ['n1']);
        if (round === 3) assert.equal(parsed.results[0].content, source.content);
      }
      return round < steps.length ? call(steps[round], `call-${round++}`) : final('Backend progress is good.');
    }, core);
    assert.deepEqual(await manager.chat('alice', 'My progress?'), { answer: 'Backend progress is good.' });
    assert.equal(plans.length, 3); assert.equal(loads.length, 1);
    assert.ok(plans.every((plan) => plan.userId === 'alice'));
    assert.deepEqual(plans[2].requests[0].sources, ['NEURON', 'MARKDOWN']);
    assert.deepEqual(loads[0], { spaceIds: ['s1'], neuronIds: ['n1'] });
  });

  await t.test('unexpected userId, Documents, graph options, malformed JSON and excessive limits fail safely', async () => {
    const bad = ['{', { ...scopeArgs, userId: 'bob' }, { ...scopeArgs, options: { maxSpaces: 100 } },
      { ...scopeArgs, options: { includeRelatedNeurons: true } },
      { requests: [{ id: 'x', query: 'x', sources: ['DOCUMENT'] }] }];
    for (const args of bad) {
      let round = 0;
      const manager = new AIManager(async (request) => {
        if (!round++) return call(args);
        assert.match(request.input.at(-1).output, /INVALID_SEARCH_REQUEST/);
        return final('Unable to search');
      }, noSearch);
      await manager.chat('alice', 'Search');
    }
    assert.equal(searchMemoryTool.parameters.properties.userId, undefined);
    assert.throws(() => toSearchPlan({ ...scopeArgs, userId: 'bob' }, 'alice'));
  });

  await t.test('foreign IDs are rejected by real owned repository queries', async () => {
    const { prisma } = require('../dist/lib/prisma');
    const original = prisma.subject.findMany;
    prisma.subject.findMany = async (args) => {
      assert.equal(args.where.userId, 'alice'); assert.equal(args.where.id, 'bob-space'); return [];
    };
    try {
      let round = 0;
      const manager = new AIManager(async (request) => {
        if (!round++) return call({ space: { id: 'bob-space' }, requests: [] });
        assert.deepEqual(JSON.parse(request.input.at(-1).output), { error: 'MEMORY_NOT_FOUND' });
        return final('No memory found');
      }, new SearchCore());
      await manager.chat('alice', 'Read Bob memory');
    } finally { prisma.subject.findMany = original; }
  });

  await t.test('round limit disables tools and never executes a fifth Search', async () => {
    let searches = 0, responses = 0;
    const manager = new AIManager(async (request) => {
      responses++;
      assert.equal(request.tool_choice, responses > MAX_TOOL_ROUNDS ? 'none' : 'auto');
      return call(scopeArgs, `c${responses}`);
    }, { execute: async () => { searches++; return empty; } });
    await assert.rejects(manager.chat('alice', 'Loop'), { code: 'AI_TOOL_LIMIT' });
    assert.equal(searches, 4); assert.equal(responses, 5);
  });

  await t.test('official SDK path uses Responses and safely forwards its answer', async (st) => {
    const { Responses } = require('openai/resources/responses/responses');
    st.mock.method(Responses.prototype, 'create', async (request) => {
      assert.equal(request.model, 'test-model'); assert.equal(request.store, false);
      assert.equal(request.tools[0].name, 'search_memory');
      return final('SDK answer');
    });
    assert.deepEqual(await new AIManager(undefined, noSearch).chat('alice', 'Hello'), { answer: 'SDK answer' });
  });

  await t.test('Search failures reveal no database details and model can recover', async () => {
    let round = 0;
    const manager = new AIManager(async (request) => {
      if (!round++) return call(scopeArgs);
      assert.deepEqual(JSON.parse(request.input.at(-1).output), { error: 'SEARCH_UNAVAILABLE' });
      assert.equal(JSON.stringify(request).includes('PRIVATE_DATABASE'), false);
      return final('Memory is unavailable.');
    }, { execute: async () => { throw new Error('PRIVATE_DATABASE'); } });
    await manager.chat('alice', 'Search');
  });

  await t.test('four large results fit the total budget and final call answers with tools disabled', async () => {
    let round = 0;
    const info = { ...empty, requests: [{ requestId: 'r', results: [{ sourceType: 'MARKDOWN',
      sourceId: 'md', subjectId: 's1', neuronId: 'n1', title: 'Title', heading: '', content: 'a'.repeat(20000) }] }] };
    const manager = new AIManager(async (request) => {
      const outputs = request.input.filter((item) => item.type === 'function_call_output');
      assert.ok(outputs.every((item) => item.output.length <= 6000));
      assert.ok(outputs.reduce((sum, item) => sum + item.output.length, 0) <= 24000);
      if (round++ < 4) return call(scopeArgs, `budget-${round}`);
      assert.equal(request.tool_choice, 'none');
      return final('Partial evidence');
    }, { execute: async () => info });
    assert.deepEqual(await manager.chat('alice', 'Search'), { answer: 'Partial evidence' });
  });

  await t.test('compaction includes escaped JSON in budget, deduplicates and removes internal fields', () => {
    const item = { sourceType: 'MARKDOWN', sourceId: 'md', subjectId: 's1', neuronId: 'n1', title: 'Name',
      heading: '', content: '\\"\n'.repeat(10000), metadata: { storageKey: 'SECRET' }, passwordHash: 'SECRET' };
    const info = { ...empty, requests: [{ requestId: 'a', results: [item, item] }] };
    for (const budget of [2, 80, 200, 1000, 6000]) {
      const output = compactSearchResult(info, budget);
      assert.ok(output.length <= budget); const parsed = JSON.parse(output);
      assert.ok((parsed.results?.length ?? 0) <= 1); assert.equal(output.includes('SECRET'), false);
    }
  });

  await t.test('provider errors, timeouts and incomplete responses have controlled errors', async () => {
    for (const [error, code] of [[new Error('PRIVATE_PROVIDER_DETAIL'), 'AI_UNAVAILABLE'],
      [new OpenAI.APIConnectionTimeoutError(), 'AI_TIMEOUT']]) {
      await assert.rejects(new AIManager(async () => { throw error; }, noSearch).chat('alice', 'Hi'),
        (e) => e instanceof AppError && e.code === code && !e.message.includes('PRIVATE'));
    }
    await assert.rejects(new AIManager(async () => ({ ...final(), status: 'incomplete' }), noSearch).chat('alice', 'Hi'), { code: 'AI_INCOMPLETE_RESPONSE' });
  });

  await t.test('missing configuration fails before calling provider', async () => {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(new AIManager(async () => assert.fail('No provider call'), noSearch).chat('alice', 'Hi'), { code: 'AI_CONFIGURATION_ERROR' });
    process.env.OPENAI_API_KEY = 'test-key';
  });
});

test('/api/ai/chat authenticates, validates and returns controlled JSON', async (t) => {
  process.env.JWT_SECRET = 'test-only-ai-secret';
  const { app } = require('../dist/app');
  const { aiManager } = require('../dist/ai/manager');
  const { AppError } = require('../dist/utils/app-error');
  const jwt = require('jsonwebtoken');
  let captured;
  t.mock.method(aiManager, 'chat', async (userId, message) => {
    captured = { userId, message };
    if (message === 'failure') throw new AppError(502, 'AI_UNAVAILABLE', 'AI service is temporarily unavailable');
    return { answer: 'Hello' };
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/ai/chat`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: 'alice' })}` };
  const post = (body, auth = true) => fetch(url, { method: 'POST', headers: auth ? headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ message: 'Hi' }, false)).status, 401);
  assert.equal(captured, undefined);
  assert.equal((await post({ message: 'Hi', userId: 'bob' })).status, 400);
  assert.equal((await post({ message: ' ' })).status, 400);
  const ok = await post({ message: ' Hi ' }); assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { answer: 'Hello' });
  assert.deepEqual(captured, { userId: 'alice', message: 'Hi' });
  const bad = await post({ message: 'failure' }); assert.equal(bad.status, 502);
  assert.deepEqual(await bad.json(), { error: { code: 'AI_UNAVAILABLE', message: 'AI service is temporarily unavailable' } });
});
