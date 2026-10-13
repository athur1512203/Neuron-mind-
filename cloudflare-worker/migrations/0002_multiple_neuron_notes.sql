CREATE TABLE notes_v2 (
  id TEXT PRIMARY KEY,
  neuron_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (neuron_id) REFERENCES neurons(id) ON DELETE CASCADE
);

INSERT INTO notes_v2 (id, neuron_id, name, content, sort_order, is_default, created_at, updated_at)
SELECT id, neuron_id, 'Ghi chú', content, 0, 1, created_at, updated_at
FROM notes;

INSERT INTO notes_v2 (id, neuron_id, name, content, sort_order, is_default, created_at, updated_at)
SELECT lower(hex(randomblob(16))), neurons.id, 'Ghi chú', '', 0, 1, neurons.created_at, neurons.updated_at
FROM neurons
WHERE NOT EXISTS (SELECT 1 FROM notes_v2 WHERE notes_v2.neuron_id = neurons.id);

DROP TABLE notes;
ALTER TABLE notes_v2 RENAME TO notes;

CREATE INDEX idx_notes_neuron_order ON notes(neuron_id, sort_order, created_at);
CREATE UNIQUE INDEX idx_notes_one_default_per_neuron ON notes(neuron_id) WHERE is_default = 1;
