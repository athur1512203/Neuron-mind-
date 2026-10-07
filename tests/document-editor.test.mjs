import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

import { EditorState, TextSelection } from 'prosemirror-state';
import { splitBlock, joinBackward, toggleMark } from 'prosemirror-commands';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const key of ['window','document','Node','Element','HTMLElement','MutationObserver','DOMParser','getComputedStyle','KeyboardEvent','MouseEvent']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.innerHeight = 900;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: () => 'test-token', removeItem() {} };
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1, bottom: 1 });
const { createRoot } = await import('react-dom/client');
await mkdir('node_modules/.cache', { recursive: true });
const output = resolve('node_modules/.cache/document-editor-tests.mjs');
await build({ stdin: { contents: `export * from './src/markdown/documentEditor'; export * from './src/markdown/noteAutosave'; export * from './src/markdown/neuronMarkdownStore'; export * from './src/components/VisualNoteEditor'; export * from './src/components/NeuronMarkdownEditor'; export * from './src/api/documents';`, resolveDir: process.cwd(), loader: 'ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'omit-css', setup(b) { b.onResolve({ filter: /\.css$/ }, () => ({ path: 'empty', namespace: 'empty-css' })); b.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => ({ contents: '', loader: 'js' })); } }], define: { 'import.meta.env.VITE_API_URL': '"https://test.invalid/api"' } });
const m = await import(pathToFileURL(output).href);
const { noteSchema: s, parseDocument, serializeDocument } = m;
const flush = () => new Promise((r) => setTimeout(r, 0));
const command = (state, fn) => { let next = state; assert.equal(fn(state, (tr) => { next = state.apply(tr); }), true); return next; };

test('unchanged Markdown round-trips byte-for-byte including all required references', () => {
  for (const value of [
    '# Title\r\n\r\n[[relation:N1]] and [[document:D1]]\r\n',
    '[label](https://example.com/a)\n\n- [ ] one\n- [x] two\n',
    '| A | B |\n|:---|---:|\n| one | two |\n',
    '[text](nm-highlight:pink) and [under](nm-underline:)\n\n![Image](document://D1)',
    'Repeated\n\n\nRepeated\n\n\nRepeated\n',
    '```js\n[[relation:CODE]]\n```\n\n<custom>unknown</custom>\n\n[ref]: https://test.com',
    '', ' \n\n',
  ]) assert.equal(serializeDocument(parseDocument(value)), value);
});

test('direct text edits, Enter and empty Backspace keep adjacent references', () => {
  let state = EditorState.create({ schema: s, doc: parseDocument('Hello\n\n[[relation:N1]] [[document:D1]]') });
  state = state.apply(state.tr.insertText(' world', 6));
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 12)));
  state = command(state, splitBlock); assert.equal(state.doc.childCount, 3);
  state = command(state, joinBackward); assert.equal(state.doc.childCount, 2);
  assert.match(serializeDocument(state.doc), /Hello world/);
  assert.match(serializeDocument(state.doc), /\[\[relation:N1\]\] \[\[document:D1\]\]/);
});

test('bold, italic, underline and highlight survive serialization after edits', () => {
  for (const name of ['strong','em','underline','highlight']) {
    let state = EditorState.create({ schema: s, doc: parseDocument('hello world') });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
    state = command(state, toggleMark(s.marks[name], name === 'highlight' ? { color: 'blue' } : undefined));
    const next = parseDocument(serializeDocument(state.doc));
    assert.equal(next.textContent, 'hello world'); assert.ok(next.firstChild.firstChild.marks.some((mark) => mark.type.name === name));
  }
});

test('checklist checkbox and table cell edits preserve structures and neighbors', () => {
  let state = EditorState.create({ schema: s, doc: parseDocument('- [ ] task\n- [x] done\n\n[[document:D1]]') });
  state = state.apply(state.tr.setNodeMarkup(1, undefined, { checked: true }));
  assert.match(serializeDocument(state.doc), /- \[x\] task\n- \[x\] done/);
  assert.match(serializeDocument(state.doc), /\[\[document:D1\]\]/);
  const doc = s.nodes.doc.create(null, [m.createTable(2, 3)]);
  state = EditorState.create({ schema: s, doc }); state = state.apply(state.tr.insertText('Edit | cell', 3, 4));
  const parsed = parseDocument(serializeDocument(state.doc));
  assert.equal(parsed.firstChild.type.name, 'table'); assert.equal(parsed.firstChild.childCount, 2);
  assert.equal(parsed.firstChild.firstChild.childCount, 3); assert.equal(parsed.firstChild.firstChild.firstChild.textContent, 'Edit | cell');
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3))); state = command(state, m.tableTab);
  assert.ok(state.selection.from > 3);
});

test('image insertion stores Document URI only; supported image validator rejects SVG/spoofed extensions', () => {
  const doc = s.nodes.doc.create(null, [s.nodes.paragraph.create(null, s.nodes.image.create({ url: 'document://D1', alt: 'Picture' }))]);
  assert.equal(serializeDocument(doc), '![Picture](document://D1)');
  assert.equal(parseDocument(serializeDocument(doc)).firstChild.firstChild.attrs.url, 'document://D1');
  for (const [name,type] of [['a.png','image/png'],['a.jpg','image/jpeg'],['a.webp','image/webp']]) assert.equal(m.validateImageFile({ name, type, size: 10 }), '');
  for (const [name,type] of [['a.svg','image/svg+xml'],['a.png','image/svg+xml'],['a.exe','image/png']]) assert.ok(m.validateImageFile({ name, type, size: 10 }));
});

test('authenticated image upload/download reuse the existing Document endpoints', async () => {
  const calls = []; globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return url.endsWith('/download') ? new Response(new Blob(['image'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } }) : Response.json({ id: 'D1', subjectId: 'S1' });
  };
  await m.uploadDocument('S1', new File(['png'], 'a.png', { type: 'image/png' }));
  assert.equal(calls[0].url, 'https://test.invalid/api/subjects/S1/documents');
  assert.equal(calls[0].init.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(calls[0].init.body.get('file').name, 'a.png');
  const url = await m.loadDocumentImage('D1', new AbortController().signal);
  assert.equal(calls[1].url, 'https://test.invalid/api/documents/D1/download');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer test-token'); assert.match(url, /^blob:/); URL.revokeObjectURL(url);
});

test('one sequential save lane preserves newer drafts, deduplicates requests and permits retry', async () => {
  const store = m.neuronMarkdownStore; const id = 'race-test'; store.applyServer(id, 'initial');
  const writes = [], finish = []; let active = 0, peak = 0;
  const save = m.createNoteSaver(async (_id, text) => { writes.push(text); peak = Math.max(peak, ++active); await new Promise((r) => finish.push(r)); active--; });
  store.setWorking(id, 'first'); const pending = save(id); assert.equal(save(id), pending);
  store.setWorking(id, 'latest'); finish.shift()(); await flush();
  assert.equal(store.getWorking(id), 'latest'); assert.equal(store.getSaved(id), 'first');
  assert.deepEqual(writes, ['first','latest']); finish.shift()(); await pending;
  assert.equal(peak, 1); assert.equal(store.getSaved(id), 'latest'); assert.equal(store.isDirty(id), false);
  let fail = true; const retry = m.createNoteSaver(async () => { if (fail) throw new Error('failure'); });
  store.setWorking(id, 'retry'); await assert.rejects(retry(id)); assert.equal(store.getWorking(id), 'retry');
  fail = false; await retry(id); assert.equal(store.isDirty(id), false);
});

async function mount(Component, props) {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(React.createElement(Component, props)));
  const click = async (label) => { const button = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label || b.textContent === label); assert.ok(button, label); await act(async () => button.click()); };
  return { container, click, render: async (next) => { await act(async () => root.render(React.createElement(Component, next))); }, close: async () => { await act(async () => root.unmount()); container.remove(); } };
}
const neurons = [{ id: 'N1', name: 'Current', subjectId: 'S1' }, { id: 'N2', name: 'Friendly name', subjectId: 'S1' }, { id: 'FOREIGN', name: 'Other Space', subjectId: 'S2' }];

test('visual editor hides IDs, has no edit-block buttons, and Link never calls relation creation', async () => {
  let relations = 0, output = '';
  const ui = await mount(m.VisualNoteEditor, { value: '[[relation:N2]]', neuronId: 'N1', neurons, documents: [], onRaw() {}, onChange: (v) => { output = v; }, onEnsureConnection: async () => { relations++; } });
  assert.match(ui.container.textContent, /Friendly name/); assert.doesNotMatch(ui.container.textContent, /N2|Sửa block/);
  await ui.click('Chèn liên kết');
  await act(async () => {
    const inputs = ui.container.querySelectorAll('form input');
    for (const [i, text] of ['Website', 'https://example.com'].entries()) {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(inputs[i], text);
      inputs[i].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
  });
  await ui.click('Chèn Link'); assert.equal(relations, 0); assert.match(output, /\[Website\]\(https:\/\/example.com\)/);
  await ui.click('Liên kết neuron');
  const dialog = ui.container.querySelector('[role=dialog]'); assert.doesNotMatch(dialog.textContent, /Current|Other Space/);
  await ui.click('Friendly name'); assert.equal(relations, 1); assert.match(output, /\[\[relation:N2\]\]/);
  await ui.close();
});

test('server load is not a visual edit and keeps trailing source whitespace', async () => {
  let changes = 0;
  const props = { value: '', neuronId: 'N1', neurons, documents: [], onRaw() {}, onChange() { changes++; }, onEnsureConnection: async () => {} };
  const ui = await mount(m.VisualNoteEditor, props);
  try {
    await ui.render({ ...props, value: 'Loaded\n\n\n' });
    assert.equal(changes, 0);
    assert.match(ui.container.querySelector('.ProseMirror').textContent, /Loaded/);
  } finally { await ui.close(); }
});

test('late GET cannot overwrite a draft that has already autosaved', async () => {
  const id = 'late-load'; m.neuronMarkdownStore.applyServer(id, 'start');
  let resolveGet;
  globalThis.fetch = async (_url, init) => init.method === 'GET'
    ? new Promise((resolve) => { resolveGet = resolve; }) : Response.json({ content: 'latest' });
  const ui = await mount(m.NeuronMarkdownEditor, { neuronId: id, neurons: [{ id, subjectId: 'S1' }], documents: [] });
  try {
    await ui.click('Markdown'); const textarea = ui.container.querySelector('textarea');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'latest');
      textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })));
    assert.equal(m.neuronMarkdownStore.getSaved(id), 'latest');
    await act(async () => { resolveGet(Response.json({ content: 'stale' })); });
    assert.equal(textarea.value, 'latest'); assert.equal(m.neuronMarkdownStore.getSaved(id), 'latest');
  } finally { await ui.close(); }
});

test('autosave debounce, Ctrl+S and same-note mode changes share the existing API/store', async () => {
  const id = 'autosave-ui'; m.neuronMarkdownStore.applyServer(id, 'start'); const writes = [];
  globalThis.fetch = async (_url, init) => { if (init.method === 'PUT') writes.push(JSON.parse(init.body).content); return Response.json({ content: 'start' }); };
  const ui = await mount(m.NeuronMarkdownEditor, { neuronId: id, neurons: [{ id, subjectId: 'S1' }], documents: [] });
  await ui.click('Markdown'); const textarea = ui.container.querySelector('textarea');
  const setText = async (text) => { await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, text); textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); };
  await setText('new [[document:D1]]');
  await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
  assert.deepEqual(writes, ['new [[document:D1]]']);
  await setText('immediate');
  await act(async () => textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })));
  assert.equal(writes.at(-1), 'immediate');
  await ui.click('Soạn thảo'); await ui.click('Markdown');
  assert.equal(ui.container.querySelector('textarea').value, 'immediate'); await ui.close();
});

test('Visual → Markdown → Visual retains references, links, checklist, table, highlight and image', async () => {
  const id = 'roundtrip-ui';
  const source = '[[relation:N2]] [[document:D1]] [Website](https://example.com)\n\n- [x] Completed\n- [ ] Pending\n\n| A | B |\n| --- | --- |\n| one | two |\n\n[Highlighted](nm-highlight:yellow)\n\n![Picture](document://D1)\n';
  m.neuronMarkdownStore.applyServer(id, source);
  globalThis.fetch = async (url) => url.endsWith('/download')
    ? new Response(new Blob(['image'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } })
    : Response.json({ content: source });
  const ui = await mount(m.NeuronMarkdownEditor, { neuronId: id, neurons: [...neurons, { id, subjectId: 'S1' }], documents: [{ id: 'D1', originalName: 'Picture', subjectId: 'S1', mimeType: 'image/png' }] });
  try {
    const toolbarShape = () => [...ui.container.querySelector('.nm-shared-toolbar').querySelectorAll('button, select, [role=separator]')].map((element) => [element.tagName, element.getAttribute('aria-label'), element.getAttribute('title')]);
    const visualToolbar = toolbarShape();
    for (let pass = 0; pass < 2; pass++) {
      assert.deepEqual(toolbarShape(), visualToolbar);
      for (const label of ['Danh sách', 'Danh sách số', 'Trích dẫn', 'Code', 'Khối code']) {
        const button = ui.container.querySelector(`button[aria-label="${label}"]`);
        assert.equal(button.disabled, true); await act(async () => button.click());
      }
      const editor = ui.container.querySelector('.ProseMirror');
      assert.equal(editor.querySelectorAll('.neuron-md-ref-chip').length, 2);
      assert.equal(editor.querySelector('a').getAttribute('href'), 'https://example.com');
      assert.equal(editor.querySelectorAll('input[type=checkbox]').length, 2);
      assert.equal(editor.querySelector('input[type=checkbox]').checked, true);
      assert.equal(editor.querySelectorAll('table td').length, 4);
      assert.equal(editor.querySelector('mark').textContent, 'Highlighted');
      assert.equal(editor.querySelectorAll('.nm-note-image').length, 1);
      await ui.click('Markdown');
      assert.deepEqual(toolbarShape(), visualToolbar);
      for (const label of ['Gạch chân', 'Tô sáng', 'Chèn ảnh']) {
        const button = ui.container.querySelector(`button[aria-label="${label}"]`);
        assert.equal(button.disabled, true); await act(async () => button.click());
      }
      assert.equal(ui.container.querySelector('textarea').value, source);
      assert.doesNotMatch(ui.container.querySelector('textarea').value, /base64|data:image|blob:/);
      await ui.click('Soạn thảo');
    }
  } finally { await ui.close(); }
});

