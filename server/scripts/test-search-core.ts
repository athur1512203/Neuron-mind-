/**
 * Temporary manual Search Core runner. Edit PLAN below, then:
 *   npm run test:search-core:manual
 * Does not change Search Core, APIs, schema, or the frontend.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { RetrievedInformation, SearchPlan } from "../src/search/types";

config({ path: resolve(__dirname, "../../.env"), quiet: true });
config({ path: resolve(__dirname, "../.env"), quiet: true });

// ========== EDIT THIS PLAN ==========
const USER_ID = ""; // leave empty to look up the Space/Neuron names below and print IDs

const PLAN: SearchPlan = {
  userId: USER_ID,
  space: {
    query: "trợ lý",
    // id: "",
  },
  neuron: {
    query: "trợ lý quản lý",
    // id: "",
  },
  requests: [
    { id: "main", query: "EDIT_ME_TO_A_MARKDOWN_FACT" },
    { id: "responsibility", query: "phụ trách" },
    { id: "progress", query: "tiến độ" },
    { id: "deadline", query: "deadline" },
    { id: "documents", query: "trợ lý", sources: ["DOCUMENT"] },
    { id: "missing", query: "xyzzy-no-such-fact-in-this-neuron-9f3c" },
  ],
  options: {
    ranking: "context",
    maxResultsPerRequest: 20,
  },
};
// ========== END EDIT ==========

const SECRET_KEYS = new Set([
  "checksum",
  "storagekey",
  "storedname",
  "passwordhash",
  "password",
  "secret",
  "credential",
  "bucket",
  "accesskey",
  "database_url",
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_KEYS.has(key.toLowerCase())) continue;
      out[key] = sanitize(nested);
    }
    return out;
  }
  return value;
}

async function lookupScope(prisma: PrismaClient, plan: SearchPlan) {
  const spaceName = plan.space?.query?.trim();
  const neuronName = plan.neuron?.query?.trim();
  if (!spaceName || !neuronName) return [];
  return prisma.neuron.findMany({
    where: {
      name: { contains: neuronName, mode: "insensitive" },
      subject: { name: { contains: spaceName, mode: "insensitive" } },
    },
    select: {
      id: true,
      name: true,
      subjectId: true,
      markdownNote: { select: { content: true } },
      documents: { select: { originalName: true } },
      subject: { select: { id: true, name: true, userId: true } },
    },
    take: 20,
  });
}

function previewMarkdown(content: string | undefined) {
  if (!content?.trim()) return "(no markdown)";
  return content.replace(/\s+/g, " ").trim().slice(0, 400);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is not set. Add it to server/.env (the same file the API uses), then rerun.");
    console.error("This script will not guess userId, Space ID, or Neuron ID.");
    process.exitCode = 1;
    return;
  }
  const { prisma } = await import("../src/lib/prisma");
  const { searchCore } = await import("../src/search/core");
  const matches = await lookupScope(prisma, PLAN);
  console.log("=== DATABASE LOOKUP (Space/Neuron names from PLAN) ===\n");
  if (!matches.length) {
    console.log("No Space/Neuron pair matched those names in the current database.");
    console.log("Fill USER_ID / space.id / neuron.id yourself. Do not invent IDs.");
  } else {
    for (const row of matches) {
      console.log({
        userId: row.subject.userId,
        spaceId: row.subject.id,
        spaceName: row.subject.name,
        neuronId: row.id,
        neuronName: row.name,
        documentNames: row.documents.map((doc) => doc.originalName),
        markdownPreview: previewMarkdown(row.markdownNote?.content),
      });
    }
  }

  const uniqueUsers = [...new Set(matches.map((row) => row.subject.userId))];
  if (!PLAN.userId.trim()) {
    if (uniqueUsers.length === 1) {
      PLAN.userId = uniqueUsers[0];
      console.log(`\nUsing the only matching userId from the database: ${PLAN.userId}\n`);
    } else {
      console.log("\nCannot run SearchCore.execute: USER_ID is empty and matching rows are not unique.");
      if (uniqueUsers.length > 1) {
        console.log("Matching userIds:", uniqueUsers.join(", "));
      }
      process.exitCode = 1;
      return;
    }
  }

  console.log("=== SEARCH PLAN ===\n");
  console.log(JSON.stringify(PLAN, null, 2));

  const information = await searchCore.execute(PLAN);
  printRetrieved(information);
}

function printRetrieved(information: RetrievedInformation) {
  console.log("\n=== RESOLVED SCOPE ===\n");
  console.log("Resolved Space IDs:", information.plan.resolvedSpaceIds);
  console.log("Resolved Neuron IDs:", information.plan.resolvedNeuronIds);

  console.log("\n=== RETRIEVED INFORMATION ===\n");
  for (const request of information.requests) {
    console.log("---");
    console.log("requestId:", request.requestId);
    console.log("query:", request.query);
    console.log("found:", request.found);
    console.log("number of results:", request.results.length);
    for (const item of request.results) {
      console.log({
        sourceType: item.sourceType,
        title: item.title,
        subjectId: item.subjectId,
        neuronId: item.neuronId,
        heading: item.heading,
        snippet: item.snippet,
        content: item.content,
        score: item.score,
        provenance: item.provenance,
      });
    }
  }

  console.log("\n=== RETRIEVED INFORMATION JSON (sanitized) ===\n");
  console.log(JSON.stringify(sanitize(information), null, 2));
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (!process.env.DATABASE_URL?.trim()) return;
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  }
})();
