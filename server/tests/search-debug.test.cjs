const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Search Core debug HTTP is flag-gated and ignores client userId", async (t) => {
  const previous = process.env.ENABLE_SEARCH_DEBUG;
  t.after(() => {
    if (previous === undefined) delete process.env.ENABLE_SEARCH_DEBUG;
    else process.env.ENABLE_SEARCH_DEBUG = previous;
  });

  process.env.JWT_SECRET = "test-only-search-secret";
  delete process.env.ENABLE_SEARCH_DEBUG;
  const { app } = require("../dist/app");
  const jwt = require("jsonwebtoken");
  const core = require("../dist/search/core");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/search`;
  const headers = {
    Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: "alice" })}`,
    "Content-Type": "application/json",
  };
  const body = {
    userId: "eve",
    space: { query: "Tài liệu học TMU" },
    neuron: { query: "Nghiên cứu khoa học" },
    requests: [{ id: "main", query: "nghiên cứu khoa học" }],
  };

  const disabled = await fetch(`${base}/debug`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(disabled.status, 404);

  process.env.ENABLE_SEARCH_DEBUG = "true";
  const unauth = await fetch(`${base}/debug`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(unauth.status, 401);

  let captured;
  t.mock.method(core.searchCore, "execute", async (plan) => {
    captured = plan;
    return {
      plan: { resolvedSpaceIds: ["space-1"], resolvedNeuronIds: ["neuron-1"] },
      requests: [{ requestId: "main", query: plan.requests[0].query, found: false, results: [] }],
      sources: [{ checksum: "secret", storageKey: "k", subjectId: "space-1", neuronId: "neuron-1" }],
    };
  });

  const ok = await fetch(`${base}/debug`, { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(ok.status, 200);
  const json = await ok.json();
  assert.equal(captured.userId, "alice");
  assert.equal(captured.requests[0].id, "main");
  assert.equal(json.requests[0].found, false);
  assert.deepEqual(json.requests[0].results, []);
  assert.equal(json.sources[0].checksum, undefined);
  assert.equal(json.sources[0].storageKey, undefined);

  const global = await fetch(`${base}?q=`, { headers });
  assert.equal(global.status, 200);
});
