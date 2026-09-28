ALTER TABLE "Document"
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "checksum" TEXT;

-- Legacy storage used only the basename when resolving storagePath.
UPDATE "Document"
SET "storageKey" = regexp_replace(replace("storagePath", chr(92), '/'), '^.*/', '');

ALTER TABLE "Document" ALTER COLUMN "storageKey" SET NOT NULL;
