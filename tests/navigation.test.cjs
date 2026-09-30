const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function setup(storage = new Map()) {
  const exports = {};
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const source = fs.readFileSync(require.resolve('../src/utils/navigation.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInNewContext(compiled.outputText, { exports, localStorage });
  return { ...exports, storage };
}
const subjects = [{ id: 'space-a' }];
const graph = { subject: subjects[0], neurons: [{ id: 'neuron-b', subjectId: 'space-a' }], connections: [] };
const saved = { activeView: 'map', selectedSubjectId: 'space-a', selectedNeuronId: 'neuron-b' };
const plain = (value) => JSON.parse(JSON.stringify(value));

test('Dashboard survives reload without loading a graph', async () => {
  const first = setup();
  first.saveNavigation('alice', { ...saved, activeView: 'dashboard' });
  const reloaded = setup(first.storage);
  const result = await reloaded.restoreNavigation(reloaded.readNavigation('alice'), subjects, () => assert.fail('No graph needed'));
  assert.deepEqual(plain(result.navigation), { activeView: 'dashboard', selectedSubjectId: null, selectedNeuronId: null });
});

test('Space and selected neuron survive reload after API validation', async () => {
  for (const selectedNeuronId of [null, 'neuron-b']) {
    const first = setup();
    first.saveNavigation('alice', { ...saved, selectedNeuronId });
    const reloaded = setup(first.storage);
    let requests = 0;
    const result = await reloaded.restoreNavigation(reloaded.readNavigation('alice'), subjects, async (id) => {
      requests++;
      assert.equal(id, 'space-a');
      return graph;
    });
    assert.equal(requests, 1);
    assert.deepEqual(plain(result.navigation), { ...saved, selectedNeuronId });
    assert.equal(result.graph, graph);
  }
});

test('Deleted neuron restores the space without a selection', async () => {
  const nav = setup();
  const result = await nav.restoreNavigation(saved, subjects, async () => ({ ...graph, neurons: [] }));
  assert.equal(result.navigation.activeView, 'map');
  assert.equal(result.navigation.selectedNeuronId, null);
});

test('Deleted or foreign space falls back before graph request', async () => {
  const nav = setup();
  const result = await nav.restoreNavigation(saved, [], () => assert.fail('Must not request an unowned space'));
  assert.deepEqual(plain(result.navigation), plain(nav.dashboardNavigation));
});

test('Logout and account mismatch discard old navigation', () => {
  const nav = setup();
  nav.saveNavigation('alice', saved);
  assert.deepEqual(plain(nav.readNavigation('bob')), plain(nav.dashboardNavigation));
  assert.equal(nav.storage.size, 0);
  nav.saveNavigation('alice', saved);
  nav.clearNavigation();
  assert.equal(nav.storage.size, 0);
  assert.deepEqual(plain(nav.readNavigation('alice')), plain(nav.dashboardNavigation));
});

test('Corrupt storage and malformed IDs fall back safely', () => {
  const nav = setup();
  for (const value of ['{bad', 'null', JSON.stringify({ userId: 'alice', ...saved, activeView: 'invalid' }),
    JSON.stringify({ userId: 'alice', ...saved, selectedSubjectId: {} }),
    JSON.stringify({ userId: 'alice', ...saved, selectedNeuronId: '' })]) {
    nav.storage.set(nav.NAVIGATION_KEY, value);
    assert.deepEqual(plain(nav.readNavigation('alice')), plain(nav.dashboardNavigation));
  }
});

test('Graph failure or mismatched subject cannot restore context', async () => {
  const nav = setup();
  for (const load of [async () => { throw new Error('404 or network error'); }, async () => ({ ...graph, subject: { id: 'other' } })]) {
    const result = await nav.restoreNavigation(saved, subjects, load);
    assert.deepEqual(plain(result.navigation), plain(nav.dashboardNavigation));
  }
  const result = await nav.restoreNavigation(saved, subjects, async () => ({ ...graph, neurons: [{ id: 'neuron-b', subjectId: 'other' }] }));
  assert.equal(result.navigation.selectedNeuronId, null);
});

test('Closing neuron clears its ID; non-graph views clear both IDs', () => {
  const nav = setup();
  nav.saveNavigation('alice', { ...saved, selectedNeuronId: null });
  assert.equal(nav.readNavigation('alice').selectedNeuronId, null);
  nav.saveNavigation('alice', { ...saved, activeView: 'settings', privateData: 'must not persist' });
  assert.deepEqual(JSON.parse(nav.storage.get(nav.NAVIGATION_KEY)), {
    userId: 'alice', activeView: 'settings', selectedSubjectId: null, selectedNeuronId: null,
  });
});

test('Unavailable localStorage does not crash navigation', () => {
  const storage = { get() { throw new Error('blocked'); }, set() { throw new Error('quota'); }, delete() { throw new Error('blocked'); } };
  const nav = setup(storage);
  assert.doesNotThrow(() => nav.saveNavigation('alice', saved));
  assert.doesNotThrow(() => nav.clearNavigation());
  assert.deepEqual(plain(nav.readNavigation('alice')), plain(nav.dashboardNavigation));
});
