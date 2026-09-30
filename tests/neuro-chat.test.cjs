const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(path, dependencies) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  vm.runInNewContext(compiled.outputText, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test('one submit batch makes one request and appends one user/assistant pair', async () => {
  const state = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let requests = 0;
  let resolve;
  const api = load('../src/api/chat.ts', { './client': { apiRequest: () => {
    requests++;
    return new Promise((done) => { resolve = done; });
  } } });
  const react = {
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useRef: (initial) => {
      const index = refIndex++;
      return refs[index] ??= { current: initial };
    },
    useEffect: () => {},
  };
  const jsx = (type, props) => ({ type, props });
  const { NeuronChat } = load('../src/components/NeuronChat.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': { MessageCircle: 'icon', Send: 'icon' }, '../api/chat': api,
  });
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return NeuronChat({ neuronId: 'a', neuronName: 'Test' });
  };
  const formOf = (tree) => tree.props.children.find((child) => child?.type === 'form');
  let form = formOf(render());
  form.props.children[0].props.onChange({ target: { value: 'quỳnh chi sinh năm bao nhiêu' } });
  form = formOf(render());
  assert.equal(form.props.children[1].props.onClick, undefined);
  const event = { preventDefault() {} };
  form.props.onSubmit(event);
  form.props.onSubmit(event); // Same closure, before React has rendered sending=true.
  assert.equal(requests, 1);
  assert.equal(state[0].length, 1);
  resolve({ found: true, answer: 'quỳnh chi sinh năm 2003', sources: [] });
  await new Promise(setImmediate);
  assert.equal(state[0].length, 2);
  assert.equal(state[0][0].role, 'user');
  assert.equal(state[0][1].role, 'assistant');
  assert.equal(state[2], false);
  // A completed request releases the lock for the next submission.
  form = formOf(render());
  form.props.children[0].props.onChange({ target: { value: 'ngọc anh sinh năm bao nhiêu' } });
  formOf(render()).props.onSubmit(event);
  assert.equal(requests, 2);
  resolve({ found: false, answer: null, sources: [{ sourceId: 'stale' }] });
  await new Promise(setImmediate);
  assert.equal(state[0].length, 4);
  assert.equal(state[0][3].content, 'Không tìm thấy thông tin liên quan trong kiến thức của neuron này.');
  assert.equal(state[0][3].sources.length, 0);
});
