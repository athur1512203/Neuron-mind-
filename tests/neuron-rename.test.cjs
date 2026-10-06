const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the component's event handlers with stable hook slots, without a DOM dependency.
function mount(onSave, name = 'Old name') {
  const slots = []; let cursor = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
  };
  const exports = {};
  const source = fs.readFileSync(require.resolve('../src/components/NeuronNameEditor.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => id === 'react' ? hooks : require(id) });
  const render = () => { cursor = 0; return exports.NeuronNameEditor({ name, onSave }); };
  function find(predicate, node = render()) {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const match = find(predicate, child ?? null); if (match) return match; }
  }
  const label = (value) => find((node) => node.props?.['aria-label'] === value);
  label('Đổi tên neuron').props.onClick();
  return { label, find, submit: () => find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }) };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('rename trims and prevents duplicate saves while waiting', async () => {
  let complete, count = 0, received;
  const ui = mount((name) => { count++; received = name; return new Promise((resolve) => { complete = resolve; }); });
  ui.label('Tên neuron').props.onChange({ target: { value: '  New name  ' } });
  ui.submit(); ui.submit();
  assert.equal(received, 'New name'); assert.equal(count, 1);
  assert.equal(ui.label('Lưu tên neuron').props.disabled, true);
  complete(); await settle();
  assert.ok(ui.label('Đổi tên neuron'));
});

test('blank names fail and Escape cancels without updating', () => {
  const ui = mount(() => assert.fail('No save'));
  ui.label('Tên neuron').props.onChange({ target: { value: '  ' } }); ui.submit();
  assert.ok(ui.find((node) => node.props?.role === 'alert'));
  ui.label('Tên neuron').props.onKeyDown({ key: 'Escape', stopPropagation() {} });
  assert.ok(ui.label('Đổi tên neuron'));
});

test('rename failure retains edit mode with safe feedback and allows retry', async () => {
  let calls = 0;
  const ui = mount(async () => { calls++; throw new Error('PRIVATE_BACKEND_ERROR'); });
  ui.label('Tên neuron').props.onChange({ target: { value: 'New' } }); ui.submit(); await settle();
  assert.ok(ui.label('Tên neuron'));
  assert.doesNotMatch(ui.find((node) => node.props?.role === 'alert').props.children, /PRIVATE/);
  ui.submit(); await settle(); assert.equal(calls, 2);
});
