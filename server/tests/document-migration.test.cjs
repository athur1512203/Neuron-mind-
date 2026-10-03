const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Document migration backfills Subject ownership without changing stored objects', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261003010000_move_documents_to_subject/migration.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN "subjectId" TEXT/);
  assert.match(migration, /SET "subjectId" = neuron\."subjectId"/);
  assert.match(migration, /WHERE document\."neuronId" = neuron\."id"/);
  assert.match(migration, /IF EXISTS[\s\S]*"subjectId" IS NULL[\s\S]*RAISE EXCEPTION/);
  assert.match(migration, /ALTER COLUMN "subjectId" SET NOT NULL/);
  assert.match(migration, /REFERENCES "Subject"\("id"\) ON DELETE CASCADE/);
  for (const forbidden of ['DELETE FROM "Document"', 'storageKey" =', 'checksum" =', 'originalName" =']) {
    assert.equal(migration.includes(forbidden), false);
  }
});
