const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { LocalStorageProvider } = require('../dist/storage/LocalStorageProvider');
const { R2StorageProvider } = require('../dist/storage/R2StorageProvider');
const { StorageObjectNotFoundError } = require('../dist/storage/StorageProvider');

test('Local adapter roundtrip, nested keys, legacy keys and traversal', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'neuromind-storage-'));
  try {
    const storage = new LocalStorageProvider(root);
    for (const key of ['legacy.pdf', 'users/u/workspaces/s/documents/id.pdf']) {
      assert.equal(await storage.exists(key), false);
      await storage.upload({ key, buffer: Buffer.from('document'), contentType: 'application/pdf' });
      assert.equal(await storage.exists(key), true);
      const chunks = [];
      for await (const chunk of await storage.getStream(key)) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).toString(), 'document');
      await storage.delete(key);
      await storage.delete(key);
      assert.equal(await storage.exists(key), false);
      await assert.rejects(storage.getStream(key), StorageObjectNotFoundError);
    }
    for (const key of ['../escape', '/absolute', 'a/../../escape', 'C:\\escape', 'a\\..\\escape']) {
      await assert.rejects(storage.upload({ key, buffer: Buffer.from('x'), contentType: 'text/plain' }));
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('R2 command contract and missing-object behavior', async () => {
  const calls = [];
  let missing = false;
  const client = { send: async (command) => {
    calls.push(command);
    if (missing) throw { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } };
    return { Body: Readable.from(['payload']) };
  } };
  const storage = new R2StorageProvider(client, 'private-bucket');
  await storage.upload({ key: 'key', buffer: Buffer.from('payload'), contentType: 'text/plain' });
  assert.equal(calls[0].input.Bucket, 'private-bucket');
  assert.equal(calls[0].input.ContentType, 'text/plain');
  assert.equal(await storage.exists('key'), true);
  assert.equal((await storage.getStream('key')) instanceof Readable, true);
  await storage.delete('key');
  missing = true;
  assert.equal(await storage.exists('missing'), false);
  await storage.delete('missing');
  await assert.rejects(storage.getStream('missing'), StorageObjectNotFoundError);
});

test('Document HTTP API with real local storage and mocked Prisma', async (t) => {
  process.env.JWT_SECRET = 'test-only-document-secret';
  process.env.STORAGE_PROVIDER = 'local';
  process.env.UPLOAD_RATE_LIMIT_MAX = '1000';
  const { prisma } = require('../dist/lib/prisma');
  const { getStorageProvider, getStorageProviderName } = require('../dist/storage');
  const { app } = require('../dist/app');
  const jwt = require('jsonwebtoken');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'neuromind-api-'));
  const local = new LocalStorageProvider(root);
  const provider = getStorageProvider();
  let failUpload = false, failCreate = false, failDelete = false;
  let uploadedKey;
  const records = new Map();
  t.mock.method(provider, 'upload', async (input) => {
    if (failUpload) throw new Error('test storage upload failure');
    uploadedKey = input.key;
    await local.upload(input);
  });
  t.mock.method(provider, 'getStream', (key) => local.getStream(key));
  t.mock.method(provider, 'delete', async (key) => {
    if (failDelete) throw new Error('test storage delete failure');
    await local.delete(key);
  });
  const mockPrisma = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  };
  mockPrisma(prisma.neuron, 'findFirst', async ({ where }) => where.id === 'neuron' && where.subject.userId === 'owner' ? { id: 'neuron', subjectId: 'subject' } : null);
  mockPrisma(prisma.document, 'create', async ({ data }) => {
    if (failCreate) throw new Error('test database failure');
    const record = { ...data, id: `doc-${records.size}`, createdAt: new Date(), updatedAt: new Date() };
    records.set(record.id, record);
    return record;
  });
  mockPrisma(prisma.document, 'findFirst', async ({ where }) => where.neuron.subject.userId === 'owner' ? records.get(where.id) ?? null : null);
  mockPrisma(prisma.document, 'findMany', async () => [...records.values()]);
  mockPrisma(prisma.document, 'delete', async ({ where }) => { const record = records.get(where.id); records.delete(where.id); return record; });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = (user = 'owner') => ({ Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: user })}` });
  const upload = (body = '%PDF-1.7\nhello', name = 'report.pdf', type = 'application/pdf', user = 'owner') => {
    const form = new FormData();
    form.append('file', new Blob([body], { type }), name);
    return fetch(`${base}/neurons/neuron/documents`, { method: 'POST', headers: headers(user), body: form });
  };
  try {
    await t.test('auth and owner checks run before upload', async () => {
      assert.equal((await fetch(`${base}/neurons/neuron/documents`, { method: 'POST' })).status, 401);
      assert.equal((await upload(undefined, undefined, undefined, 'other')).status, 404);
      assert.equal(records.size, 0);
    });
    let id;
    await t.test('upload, metadata, checksum and download headers', async () => {
      const response = await upload();
      assert.equal(response.status, 201);
      const data = await response.json(); id = data.id;
      assert.equal(data.storageKey, undefined);
      assert.equal(data.storagePath, undefined);
      const record = records.get(id);
      assert.match(record.storageKey, /^users\/owner\/workspaces\/subject\/documents\/.+\.pdf$/);
      assert.match(record.checksum, /^[a-f0-9]{64}$/);
      const download = await fetch(`${base}/documents/${id}/download`, { headers: headers() });
      assert.equal(download.status, 200);
      assert.match(download.headers.get('content-disposition'), /attachment;.*report.pdf/);
      assert.equal(download.headers.get('content-type'), 'application/pdf');
      assert.equal(await download.text(), '%PDF-1.7\nhello');
      assert.equal((await fetch(`${base}/documents/${id}/download`, { headers: headers('other') })).status, 404);
      assert.equal((await fetch(`${base}/documents/${id}`, { method: 'DELETE', headers: headers('other') })).status, 404);
    });
    await t.test('validation rejects empty, spoofed and unexpected uploads', async () => {
      assert.equal((await upload('')).status, 400);
      assert.equal((await upload('MZexecutable')).status, 400);
      assert.equal((await upload('script', 'bad.exe', 'application/octet-stream')).status, 400);
      assert.equal((await fetch(`${base}/neurons/neuron/documents`, { method: 'POST', headers: headers() })).status, 400);
    });
    await t.test('upload failure and database rollback', async () => {
      failUpload = true;
      assert.equal((await upload()).status, 500);
      assert.equal(records.size, 1);
      failUpload = false; failCreate = true;
      assert.equal((await upload()).status, 500);
      assert.equal(await local.exists(uploadedKey), false);
      assert.equal(records.size, 1);
      failCreate = false;
    });
    await t.test('delete failure retains metadata; successful delete removes both', async () => {
      const key = records.get(id).storageKey;
      failDelete = true;
      assert.equal((await fetch(`${base}/documents/${id}`, { method: 'DELETE', headers: headers() })).status, 500);
      assert.equal(records.has(id), true);
      assert.equal(await local.exists(key), true);
      failDelete = false;
      assert.equal((await fetch(`${base}/documents/${id}`, { method: 'DELETE', headers: headers() })).status, 204);
      assert.equal(records.has(id), false);
      assert.equal(await local.exists(key), false);
      assert.equal((await fetch(`${base}/documents/${id}/download`, { headers: headers() })).status, 404);
    });
    await t.test('missing object can still be deleted and legacy provider overrides default', async () => {
      const response = await upload(); const data = await response.json();
      await local.delete(records.get(data.id).storageKey);
      assert.equal((await fetch(`${base}/documents/${data.id}/download`, { headers: headers() })).status, 404);
      process.env.STORAGE_PROVIDER = 'r2';
      assert.equal((await fetch(`${base}/documents/${data.id}`, { method: 'DELETE', headers: headers() })).status, 204);
      process.env.STORAGE_PROVIDER = 'invalid';
      assert.throws(getStorageProviderName, /STORAGE_PROVIDER/);
      process.env.STORAGE_PROVIDER = 'local';
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
    await prisma.$disconnect();
  }
});

test('Delete space removes owned storage objects after ownership check', async (t) => {
  process.env.JWT_SECRET = 'test-only-document-secret';
  process.env.STORAGE_PROVIDER = 'local';
  const { prisma } = require('../dist/lib/prisma');
  const { documentService } = require('../dist/services/document.service');
  const { app } = require('../dist/app');
  const jwt = require('jsonwebtoken');
  const deleted = [];
  t.mock.method(documentService, 'deleteObject', async (document) => {
    deleted.push(document.storageKey);
  });
  const originalFindFirst = prisma.subject.findFirst;
  const originalFindMany = prisma.document.findMany;
  const originalDelete = prisma.subject.delete;
  t.after(() => {
    prisma.subject.findFirst = originalFindFirst;
    prisma.document.findMany = originalFindMany;
    prisma.subject.delete = originalDelete;
  });
  prisma.subject.findFirst = async ({ where }) => (
    where.id === 'space-1' && where.userId === 'owner' ? { id: 'space-1', userId: 'owner' } : null
  );
  prisma.document.findMany = async ({ where }) => {
    if (where?.neuron?.subjectId !== 'space-1' || where.neuron.subject.userId !== 'owner') return [];
    return [{ id: 'doc-1', storageProvider: 'local', storageKey: 'users/owner/workspaces/space-1/documents/a.pdf' }];
  };
  let dbDeleted = false;
  prisma.subject.delete = async ({ where }) => {
    dbDeleted = where.id === 'space-1';
    return { id: 'space-1' };
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = (user) => ({ Authorization: `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: user })}` });
  try {
    assert.equal((await fetch(`${base}/subjects/space-1`, { method: 'DELETE', headers: headers('other') })).status, 404);
    assert.equal(deleted.length, 0);
    assert.equal(dbDeleted, false);
    assert.equal((await fetch(`${base}/subjects/space-1`, { method: 'DELETE', headers: headers('owner') })).status, 204);
    assert.deepEqual(deleted, ['users/owner/workspaces/space-1/documents/a.pdf']);
    assert.equal(dbDeleted, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
