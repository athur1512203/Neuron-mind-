-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Neuron" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "textContent" TEXT NOT NULL DEFAULT '',
    "keyPoints" TEXT NOT NULL DEFAULT '',
    "memoryMethod" TEXT NOT NULL DEFAULT '',
    "application" TEXT NOT NULL DEFAULT '',
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Neuron_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeuronConnection" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sourceNeuronId" TEXT NOT NULL,
    "targetNeuronId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeuronConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeuronImage" (
    "id" TEXT NOT NULL,
    "neuronId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeuronImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeuronAudio" (
    "id" TEXT NOT NULL,
    "neuronId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeuronAudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Subject_userId_idx" ON "Subject"("userId");

-- CreateIndex
CREATE INDEX "Neuron_subjectId_idx" ON "Neuron"("subjectId");

-- CreateIndex
CREATE INDEX "NeuronConnection_subjectId_idx" ON "NeuronConnection"("subjectId");

-- CreateIndex
CREATE INDEX "NeuronConnection_sourceNeuronId_idx" ON "NeuronConnection"("sourceNeuronId");

-- CreateIndex
CREATE INDEX "NeuronConnection_targetNeuronId_idx" ON "NeuronConnection"("targetNeuronId");

-- CreateIndex
CREATE UNIQUE INDEX "NeuronConnection_subjectId_sourceNeuronId_targetNeuronId_key" ON "NeuronConnection"("subjectId", "sourceNeuronId", "targetNeuronId");

-- CreateIndex
CREATE INDEX "NeuronImage_neuronId_idx" ON "NeuronImage"("neuronId");

-- CreateIndex
CREATE INDEX "NeuronAudio_neuronId_idx" ON "NeuronAudio"("neuronId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Neuron" ADD CONSTRAINT "Neuron_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeuronConnection" ADD CONSTRAINT "NeuronConnection_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeuronConnection" ADD CONSTRAINT "NeuronConnection_sourceNeuronId_fkey" FOREIGN KEY ("sourceNeuronId") REFERENCES "Neuron"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeuronConnection" ADD CONSTRAINT "NeuronConnection_targetNeuronId_fkey" FOREIGN KEY ("targetNeuronId") REFERENCES "Neuron"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeuronImage" ADD CONSTRAINT "NeuronImage_neuronId_fkey" FOREIGN KEY ("neuronId") REFERENCES "Neuron"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeuronAudio" ADD CONSTRAINT "NeuronAudio_neuronId_fkey" FOREIGN KEY ("neuronId") REFERENCES "Neuron"("id") ON DELETE CASCADE ON UPDATE CASCADE;
