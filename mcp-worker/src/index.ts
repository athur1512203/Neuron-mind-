import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { NeuronMindApi, type Env } from "./api";

const id = z.string().trim().min(1).max(200);
const name = z.string().trim().min(1).max(120);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a six-digit hex color such as #20D6C7");
const noteContent = z.string().max(1_048_576, "Note content must not exceed 1 MiB");

function result(data: unknown, summary: string) {
  return {
    structuredContent: data as Record<string, unknown>,
    content: [{ type: "text" as const, text: summary }],
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected NeuronMind error";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function layoutPosition(seed: string, isFirstNeuron: boolean) {
  if (isFirstNeuron) return { positionX: 0, positionY: 0, positionZ: 0 };
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = hash >>> 0;
  return {
    positionX: ((normalized % 601) - 300) / 1000,
    positionY: (((normalized >>> 11) % 601) - 300) / 1000,
    positionZ: (((normalized >>> 20) % 601) - 300) / 1000,
  };
}

function appendNeuronLink(content: string | null, neuronId: string, label: string) {
  const trimmed = content?.trim() ?? "";
  if (trimmed.startsWith("{")) {
    try {
      const payload = JSON.parse(content ?? "") as {
        format?: string;
        version?: number;
        doc?: { type?: string; content?: unknown[] };
      };
      if (payload.format === "neuromind-rich-text" && payload.version === 1 && payload.doc?.type === "doc") {
        const blocks = Array.isArray(payload.doc.content) ? payload.doc.content : [];
        payload.doc.content = [...blocks, {
          type: "paragraph",
          attrs: { original: null, stamp: null, before: null },
          content: [{ type: "neuron_link", attrs: { neuronId, label } }],
        }];
        return JSON.stringify(payload);
      }
    } catch {
      // Preserve malformed or non-NeuronMind JSON as legacy text below.
    }
  }
  const reference = `[[relation:${neuronId}]]`;
  if ((content ?? "").includes(reference)) return content ?? "";
  return `${content ?? ""}${content ? "\n\n" : ""}${reference}`;
}

function createServer(env: Env) {
  const api = new NeuronMindApi(env);
  const server = new McpServer(
    { name: "neuromind", version: "0.1.0" },
    { instructions: "Use Space IDs and neuron IDs returned by read tools. Notes are stored verbatim and may contain NeuronMind JSON Rich Text. This server has no delete tools." },
  );

  server.registerTool("list_spaces", {
    title: "List NeuronMind spaces",
    description: "List every Space owned by the configured NeuronMind account.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => {
    try {
      const spaces = await api.listSpaces();
      return result({ spaces }, `Found ${spaces.length} NeuronMind Space(s).`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("create_space", {
    title: "Create a NeuronMind space",
    description: "Create a new Space in the configured NeuronMind account.",
    inputSchema: {
      name,
      color: color.default("#20D6C7").describe("Space color as a six-digit hex value."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (input) => {
    try {
      const space = await api.createSpace(input);
      return result({ space }, `Created Space “${space.name}” (${space.id}).`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("list_neurons", {
    title: "List neurons",
    description: "List neurons in one NeuronMind Space. Call list_spaces first when the Space ID is unknown.",
    inputSchema: { space_id: id.describe("Existing NeuronMind Space ID.") },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ space_id }) => {
    try {
      const neurons = await api.listNeurons(space_id);
      return result({ spaceId: space_id, neurons }, `Found ${neurons.length} neuron(s).`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("create_neuron", {
    title: "Create a neuron",
    description: "Create a neuron in a Space and optionally save its note content verbatim.",
    inputSchema: {
      space_id: id.describe("Existing NeuronMind Space ID."),
      name,
      color: color.default("#20D6C7").describe("Neuron color as a six-digit hex value."),
      content: noteContent.optional().describe("Optional note content. NeuronMind JSON Rich Text is accepted and preserved verbatim."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ space_id, name: neuronName, color: neuronColor, content }) => {
    try {
      const current = await api.listNeurons(space_id);
      const neuron = await api.createNeuron(space_id, {
        name: neuronName,
        color: neuronColor,
        textContent: "",
        keyPoints: "",
        memoryMethod: "",
        application: "",
        ...layoutPosition(`${space_id}:${neuronName.toLowerCase()}`, current.length === 0),
      });
      let note = null;
      if (content !== undefined) {
        try {
          note = await api.saveNote(neuron.id, content);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "unknown note error";
          return failure(new Error(`Neuron ${neuron.id} was created, but its note could not be saved: ${detail}`));
        }
      }
      return result({ neuron, note }, `Created neuron “${neuron.name}” (${neuron.id}).`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("get_neuron", {
    title: "Get a neuron",
    description: "Read a neuron and its current note from NeuronMind.",
    inputSchema: { neuron_id: id.describe("Existing neuron ID.") },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ neuron_id }) => {
    try {
      const [neuron, note] = await Promise.all([api.getNeuron(neuron_id), api.getNote(neuron_id)]);
      return result({ neuron, note }, `Loaded neuron “${neuron.name}”.`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("update_neuron", {
    title: "Update a neuron",
    description: "Update a neuron's name, color, and/or note. Note content is stored verbatim.",
    inputSchema: {
      neuron_id: id.describe("Existing neuron ID."),
      name: name.optional(),
      color: color.optional(),
      content: noteContent.optional().describe("Replacement note content, including NeuronMind JSON Rich Text."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ neuron_id, name: neuronName, color: neuronColor, content }) => {
    if (neuronName === undefined && neuronColor === undefined && content === undefined) {
      return failure(new Error("Provide at least one of name, color, or content."));
    }
    try {
      const patch: Record<string, unknown> = {};
      if (neuronName !== undefined) patch.name = neuronName;
      if (neuronColor !== undefined) patch.color = neuronColor;
      if (Object.keys(patch).length) await api.updateNeuron(neuron_id, patch);
      if (content !== undefined) {
        try {
          await api.saveNote(neuron_id, content);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "unknown note error";
          return failure(new Error(`Neuron fields may have been updated, but its note could not be saved: ${detail}`));
        }
      }
      const [neuron, note] = await Promise.all([api.getNeuron(neuron_id), api.getNote(neuron_id)]);
      return result({ neuron, note }, `Updated neuron “${neuron.name}”.`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("search_neurons", {
    title: "Search neurons",
    description: "Search the configured account for neurons by name or indexed note content.",
    inputSchema: {
      query: z.string().trim().min(1).max(500),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ query, limit }) => {
    try {
      const response = await api.search(query, limit);
      const seen = new Set<string>();
      const matches = response.results.filter((item) => {
        const neuronId = item.neuronId ?? (item.type === "neuron" ? item.id : undefined);
        if (!neuronId || seen.has(neuronId)) return false;
        seen.add(neuronId);
        return true;
      });
      return result({ query, matches }, `Found ${matches.length} matching neuron(s).`);
    } catch (error) { return failure(error); }
  });

  server.registerTool("create_neuron_link", {
    title: "Link two neurons",
    description: "Create a graph link between two neurons in the same Space using NeuronMind's existing connection API.",
    inputSchema: {
      space_id: id.describe("Space containing both neurons."),
      source_neuron_id: id.describe("First neuron ID."),
      target_neuron_id: id.describe("Second neuron ID."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ space_id, source_neuron_id, target_neuron_id }) => {
    if (source_neuron_id === target_neuron_id) return failure(new Error("A neuron cannot link to itself."));
    try {
      const [source, target, sourceNote] = await Promise.all([
        api.getNeuron(source_neuron_id),
        api.getNeuron(target_neuron_id),
        api.getNote(source_neuron_id),
      ]);
      if (source.subjectId !== space_id || target.subjectId !== space_id) {
        return failure(new Error("Both neurons must belong to the supplied Space."));
      }
      const connection = await api.createConnection(space_id, source_neuron_id, target_neuron_id);
      try {
        await api.saveNote(source_neuron_id, appendNeuronLink(sourceNote.content, target_neuron_id, target.name));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown note error";
        return failure(new Error(`Link ${connection.id} was created, but the source note reference could not be saved: ${detail}`));
      }
      return result({ connection }, `Created neuron link ${connection.id}.`);
    } catch (error) { return failure(error); }
  });

  return server;
}

async function tokensMatch(provided: string, expected: string) {
  const encode = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [left, right] = await Promise.all([encode(provided), encode(expected)]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ ok: true, service: "neuromind-mcp" });
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    if (typeof env.MCP_BEARER_TOKEN !== "string" || env.MCP_BEARER_TOKEN.length < 32 || !env.MCP_USER_ID || env.MCP_USER_ID === "REPLACE_AFTER_REGISTERING_A_USER" || !env.DB) {
      return Response.json({ error: "Server is not configured" }, { status: 503 });
    }
    const authorization = request.headers.get("Authorization") ?? "";
    const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!provided || !(await tokensMatch(provided, env.MCP_BEARER_TOKEN))) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" },
      });
    }
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
