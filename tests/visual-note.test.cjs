const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}
const { parseNoteBlocks, formatBlock, replaceNoteBlock, blockCommands } = load('../src/markdown/visualBlocks.ts');

test('Markdown remains byte-identical through visual parse/serialization with tokens and unsupported syntax', () => {
  for (const source of [
    '# Title\n\nText **bold** and *italic*.\n\n[[relation:N17]] [[document:D3]]\n',
    '  \n\n# Title\n\n\nParagraph  \nsoft break\n',
    '```ts\nconst x = `value`;\n\nconst y = "[[relation:N17]]";\n```\n\nAfter',
    '~~~js\ncode\n\n~~~\n',
    '| A | B |\n|---|---|\n| 1 | 2 |\n\n![alt](https://example.test/image.png)',
    '- [x] done\n- [ ] pending\n\n4. four\n5. five',
    '> quote\n> more\n\n- item\n  - nested\n\n[ref]: https://example.test',
    '# Windows\r\n\r\n[[document:id]]\r\n',
    '<script>alert(1)</script>\n\nHeading\n=======', '', '\n\n',
  ]) {
    let result = source;
    for (const block of [...parseNoteBlocks(source)].reverse()) {
      result = replaceNoteBlock(result, block, formatBlock(block.kind, block.text, block));
    }
    assert.equal(result, source);
  }
});

test('editing one block preserves surrounding Markdown and atomic custom references', () => {
  const source = '[[relation:ABC]]\n\n# Old title\n\n[[document:XYZ]]\n\n| raw | table |';
  const blocks = parseNoteBlocks(source);
  assert.equal(blocks[0].kind, 'raw'); assert.equal(blocks[2].kind, 'raw');
  const result = replaceNoteBlock(source, blocks[1], formatBlock('h2', 'New title', blocks[1]));
  assert.equal(result, source.replace('# Old title', '## New title'));
  assert.equal(formatBlock('raw', 'accidental replacement', blocks[0]), '[[relation:ABC]]');
});

test('commands produce all required block types and keep checked checklist items', () => {
  assert.equal(blockCommands.length, 10);
  for (const kind of ['text', 'h1', 'h2', 'h3', 'bullet', 'number', 'check', 'quote', 'code', 'divider']) {
    const markdown = formatBlock(kind, 'Hello');
    assert.equal(parseNoteBlocks(markdown)[0].kind, kind);
  }
  const checked = parseNoteBlocks('- [x] done\n- [ ] pending')[0];
  assert.equal(formatBlock('check', 'done updated\npending', checked), '- [x] done updated\n- [ ] pending');
  const fenced = formatBlock('code', '```\ninner\n```');
  assert.equal(parseNoteBlocks(fenced)[0].text, '```\ninner\n```');
});

test('blank block is editable and slash selection can replace it with a heading', () => {
  const source = 'Existing\n\n';
  const empty = parseNoteBlocks(source).at(-1);
  const slash = replaceNoteBlock(source, empty, '/');
  const slashBlock = parseNoteBlocks(slash).at(-1);
  assert.equal(replaceNoteBlock(slash, slashBlock, formatBlock('h1', '')), 'Existing\n\n# ');
});

test('visual changes remain in the existing working store across mode switches and commit', () => {
  const { neuronMarkdownStore: store } = load('../src/markdown/neuronMarkdownStore.ts');
  const saved = 'Original\n\n[[relation:N1]]';
  store.applyServer('n', saved);
  const edited = replaceNoteBlock(saved, parseNoteBlocks(saved)[0], 'Edited **text**');
  store.setWorking('n', edited);
  assert.equal(store.getWorking('n'), edited); assert.equal(store.isDirty('n'), true);
  assert.equal(store.applyServer('n', 'late server result'), false);
  store.commit('n', store.getWorking('n'));
  assert.equal(store.getSaved('n'), edited); assert.equal(store.isDirty('n'), false);
  assert.match(store.getSaved('n'), /\[\[relation:N1\]\]/);
});
