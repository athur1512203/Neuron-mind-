-- CreateTable
CREATE TABLE "MarkdownNote" (
    "id" TEXT NOT NULL,
    "neuronId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkdownNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarkdownNote_neuronId_key" ON "MarkdownNote"("neuronId");

-- AddForeignKey
ALTER TABLE "MarkdownNote" ADD CONSTRAINT "MarkdownNote_neuronId_fkey" FOREIGN KEY ("neuronId") REFERENCES "Neuron"("id") ON DELETE CASCADE ON UPDATE CASCADE;
