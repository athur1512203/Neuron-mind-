-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "neuronId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_neuronId_idx" ON "Document"("neuronId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_neuronId_fkey" FOREIGN KEY ("neuronId") REFERENCES "Neuron"("id") ON DELETE CASCADE ON UPDATE CASCADE;
