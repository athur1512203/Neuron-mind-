-- Backfill each document from its current neuron before changing the ownership FK.
-- This preserves document IDs, object keys, checksums and every stored object.
ALTER TABLE "Document" ADD COLUMN "subjectId" TEXT;

UPDATE "Document" AS document
SET "subjectId" = neuron."subjectId"
FROM "Neuron" AS neuron
WHERE document."neuronId" = neuron."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Document" WHERE "subjectId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate Document: a document has no owning neuron/subject';
  END IF;
END $$;

ALTER TABLE "Document" ALTER COLUMN "subjectId" SET NOT NULL;
DROP INDEX "Document_neuronId_idx";
ALTER TABLE "Document" DROP CONSTRAINT "Document_neuronId_fkey";
ALTER TABLE "Document" DROP COLUMN "neuronId";
CREATE INDEX "Document_subjectId_idx" ON "Document"("subjectId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
