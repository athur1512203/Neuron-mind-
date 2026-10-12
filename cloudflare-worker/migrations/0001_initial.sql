PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_spaces_user_updated ON spaces(user_id, updated_at DESC);

CREATE TABLE neurons (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  text_content TEXT NOT NULL DEFAULT '',
  note TEXT,
  key_points TEXT NOT NULL DEFAULT '',
  memory_method TEXT NOT NULL DEFAULT '',
  application TEXT NOT NULL DEFAULT '',
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  position_z REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_neurons_space_created ON neurons(space_id, created_at);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  neuron_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (neuron_id) REFERENCES neurons(id) ON DELETE CASCADE
);

CREATE TABLE neuron_connections (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  source_neuron_id TEXT NOT NULL,
  target_neuron_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_neuron_id) REFERENCES neurons(id) ON DELETE CASCADE,
  FOREIGN KEY (target_neuron_id) REFERENCES neurons(id) ON DELETE CASCADE,
  CHECK (source_neuron_id <> target_neuron_id),
  UNIQUE (space_id, source_neuron_id, target_neuron_id)
);
CREATE INDEX idx_connections_space ON neuron_connections(space_id);
CREATE INDEX idx_connections_source ON neuron_connections(source_neuron_id);
CREATE INDEX idx_connections_target ON neuron_connections(target_neuron_id);

CREATE TABLE neuron_images (
  id TEXT PRIMARY KEY,
  neuron_id TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (neuron_id) REFERENCES neurons(id) ON DELETE CASCADE
);
CREATE INDEX idx_neuron_images_neuron ON neuron_images(neuron_id);

CREATE TABLE neuron_audio (
  id TEXT PRIMARY KEY,
  neuron_id TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (neuron_id) REFERENCES neurons(id) ON DELETE CASCADE
);
CREATE INDEX idx_neuron_audio_neuron ON neuron_audio(neuron_id);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  checksum TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_documents_space_created ON documents(space_id, created_at DESC);
