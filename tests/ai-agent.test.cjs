const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Same dependency-free TS test approach as navigation.test.cjs; mock only browser I/O.
function setup(fetch = () => assert.fail('Unexpected network')) {
  const modules = new Map(), storage = new Map([['neuromind_token', 'test-jwt']]);
  const globals = { AbortController, Headers, FormData, setTimeout, clearTimeout, fetch,
    localStorage: { getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key) } };
  function load(file) {
    file = path.resolve(__dirname, '..', file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const source = fs.readFileSync(file, 'utf8').replace('import.meta.env.VITE_API_URL', '"https://test.invalid/api"');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    const localRequire = (name) => {
      if (name.endsWith('.css')) return {};
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(file), name);
      return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
    };
    vm.runInNewContext(compiled.outputText, { ...globals, module, exports: module.exports, require: localRequire });
    return module.exports;
  }
  return { load, storage };
}

test('AI Agent clean initial render has mascot, accessible input and disabled send, no empty log', () => {
  const { load } = setup();
  const { AIAgent } = load('src/components/AIAgent.tsx');
  const html = renderToStaticMarkup(React.createElement(AIAgent));
  assert.match(html, /JARVIS/); assert.match(html, /Sẵn sàng/);
  assert.match(html, /aria-label="Yêu cầu cho NeuroMind"/);
  assert.match(html, /aria-label="Gửi yêu cầu" disabled/);
  assert.doesNotMatch(html, /role="log"/);
  assert.match(html, /Trình duyệt chưa hỗ trợ nhập giọng nói/);
});

test('sidebar renders AI Agent using existing navigation with active state', () => {
  const { Sidebar } = setup().load('src/components/Sidebar.tsx');
  const html = renderToStaticMarkup(React.createElement(Sidebar, {
    activeView: 'aiAgent', subjects: [], selectedSubjectId: null, userLabel: 'alice', layoutMode: 'desktop',
  }));
  assert.match(html, /sidebar-nav-item is-active[^>]*aria-current="page"/);
  assert.match(html, /AI Agent/);
});

test('empty input, loading, duplicate prevention, API path/JWT, answer and keyboard behavior', async () => {
  let resolve, calls = 0;
  const { load } = setup(async (url, init) => {
    calls++;
    assert.equal(url, 'https://test.invalid/api/ai/chat');
    assert.equal(init.method, 'POST'); assert.equal(init.headers.get('Authorization'), 'Bearer test-jwt');
    assert.deepEqual(JSON.parse(init.body), { message: 'My progress?' });
    return new Promise((done) => { resolve = () => done({ ok: true, status: 200, json: async () => ({ answer: 'First line\nSecond line' }) }); });
  });
  const { AgentSession, shouldSend } = load('src/components/ai-session.ts');
  const session = new AgentSession();
  session.setDraft('  '); await session.submit(); assert.equal(calls, 0);
  session.setDraft('My progress?'); const pending = session.submit();
  assert.equal(session.getSnapshot().state, 'thinking'); assert.equal(session.getSnapshot().busy, true);
  session.setDraft('duplicate'); await session.submit(); assert.equal(calls, 1);
  resolve(); await pending;
  assert.equal(session.getSnapshot().messages[1].content, 'First line\nSecond line');
  assert.equal(session.getSnapshot().state, 'answering'); assert.equal(session.getSnapshot().busy, false);
  assert.equal(shouldSend({ key: 'Enter', shiftKey: false, isComposing: false }), true);
  assert.equal(shouldSend({ key: 'Enter', shiftKey: true, isComposing: false }), false);
  assert.equal(shouldSend({ key: 'Enter', shiftKey: false, isComposing: true }), false);
  session.dispose();
});

test('HTTP and network failures show safe errors; 401 uses existing session reset', async () => {
  for (const status of [401, 403, 429, 500, 503, 0]) {
    const { load, storage } = setup(async () => {
      if (!status) throw new Error('PRIVATE_NETWORK');
      return { ok: false, status, json: async () => ({ error: { message: 'PRIVATE_PROVIDER', code: 'SECRET' } }) };
    });
    let reset = false;
    load('src/api/client.ts').setUnauthorizedHandler(() => { reset = true; });
    const { AgentSession } = load('src/components/ai-session.ts');
    const session = new AgentSession(); session.setDraft('Hello'); await session.submit();
    assert.equal(session.getSnapshot().state, 'error');
    assert.doesNotMatch(session.getSnapshot().error, /PRIVATE|SECRET/);
    assert.equal(session.getSnapshot().draft, 'Hello');
    assert.equal(reset, status === 401);
    if (status === 401) assert.equal(storage.has('neuromind_token'), false);
    session.dispose();
  }
});

test('timeout is recoverable; navigating away aborts and ignores late responses', async () => {
  const { AgentSession } = setup().load('src/components/ai-session.ts');
  const session = new AgentSession((_message, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), 5);
  session.setDraft('Slow'); await session.submit();
  assert.match(session.getSnapshot().error, /quá lâu/); assert.equal(session.getSnapshot().busy, false);
  let complete, signal;
  const leaving = new AgentSession((_message, requestSignal) => { signal = requestSignal; return new Promise((resolve) => { complete = resolve; }); });
  leaving.setDraft('Leave'); const pending = leaving.submit(); leaving.dispose();
  assert.equal(signal.aborted, true); complete('Late answer'); await pending;
  assert.equal(leaving.getSnapshot().messages.length, 1);
});

test('voice input is inserted and never submitted automatically', async () => {
  const { AgentSession } = setup().load('src/components/ai-session.ts');
  const session = new AgentSession(() => assert.fail('Speech must not auto-submit'));
  session.listen(); session.setDraft('Nội dung giọng nói'); await session.submit();
  assert.equal(session.getSnapshot().state, 'listening');
  session.stopListening(); assert.equal(session.getSnapshot().state, 'idle');
  assert.equal(session.getSnapshot().draft, 'Nội dung giọng nói');
  assert.equal(session.getSnapshot().messages.length, 0);
});
