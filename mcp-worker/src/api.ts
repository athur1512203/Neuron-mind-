export type Env = { DB: D1Database; MCP_BEARER_TOKEN: string; MCP_USER_ID: string };
export type Space = { id: string; name: string; color: string | null; neuronCount?: number; connectionCount?: number; createdAt?: string; updatedAt?: string };
export type Neuron = { id: string; subjectId: string; name: string; color: string; textContent: string; note: string | null; keyPoints: string; memoryMethod: string; application: string; positionX: number; positionY: number; positionZ: number; createdAt: string; updatedAt: string };
export type Note = { id?: string; neuronId: string; content: string | null; createdAt?: string; updatedAt?: string };
export type Connection = { id: string; subjectId: string; sourceNeuronId: string; targetNeuronId: string; createdAt: string };
export type SearchResponse = { query: string; limit: number; results: Array<{ id: string; type: string; title: string; snippet: string; neuronId?: string; subjectId?: string; subjectName?: string; updatedAt?: string }> };

const neuronSelect = `n.id, n.space_id AS subjectId, n.name, n.color, n.text_content AS textContent, n.note, n.key_points AS keyPoints, n.memory_method AS memoryMethod, n.application, n.position_x AS positionX, n.position_y AS positionY, n.position_z AS positionZ, n.created_at AS createdAt, n.updated_at AS updatedAt`;
const timestamp = () => new Date().toISOString();
const likePattern = (value: string) => {
  const encoder = new TextEncoder(); let safe = "";
  for (const character of value.replace(/[\\%_]/g, "\\$&")) { if (encoder.encode(safe + character).byteLength > 46) break; safe += character; }
  return `%${safe}%`;
};

export class NeuronMindApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = "NeuronMindApiError"; }
}

export class NeuronMindApi {
  constructor(private readonly env: Env) {}

  private async owner() {
    const user = await this.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(this.env.MCP_USER_ID).first();
    if (!user) throw new NeuronMindApiError(503, "MCP_ACCOUNT_NOT_FOUND", "The configured MCP_USER_ID does not identify a D1 user");
    return this.env.MCP_USER_ID;
  }
  private async space(spaceId: string) {
    const space = await this.env.DB.prepare("SELECT id FROM spaces WHERE id = ? AND user_id = ?").bind(spaceId, await this.owner()).first();
    if (!space) throw new NeuronMindApiError(404, "SUBJECT_NOT_FOUND", "Space not found");
    return spaceId;
  }
  private async neuron(neuronId: string) {
    const neuron = await this.env.DB.prepare(`SELECT ${neuronSelect} FROM neurons n JOIN spaces s ON s.id = n.space_id WHERE n.id = ? AND s.user_id = ?`).bind(neuronId, await this.owner()).first<Neuron>();
    if (!neuron) throw new NeuronMindApiError(404, "NEURON_NOT_FOUND", "Neuron not found");
    return neuron;
  }
  async listSpaces() {
    const rows = await this.env.DB.prepare(`SELECT s.id, s.name, s.color, s.created_at AS createdAt, s.updated_at AS updatedAt, COUNT(DISTINCT n.id) AS neuronCount, COUNT(DISTINCT c.id) AS connectionCount FROM spaces s LEFT JOIN neurons n ON n.space_id = s.id LEFT JOIN neuron_connections c ON c.space_id = s.id WHERE s.user_id = ? GROUP BY s.id ORDER BY s.updated_at DESC`).bind(await this.owner()).all<Space>();
    return rows.results;
  }
  async createSpace(input: { name: string; color: string }) {
    const userId = await this.owner(), spaceId = crypto.randomUUID(), created = timestamp();
    await this.env.DB.prepare("INSERT INTO spaces (id, user_id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(spaceId, userId, input.name, input.color, created, created).run();
    return { id: spaceId, name: input.name, color: input.color, createdAt: created, updatedAt: created, neuronCount: 0, connectionCount: 0 };
  }
  async listNeurons(spaceId: string) {
    await this.space(spaceId);
    return (await this.env.DB.prepare(`SELECT ${neuronSelect} FROM neurons n WHERE n.space_id = ? ORDER BY n.created_at`).bind(spaceId).all<Neuron>()).results;
  }
  async createNeuron(spaceId: string, input: Record<string, unknown>) {
    await this.space(spaceId); const neuronId = crypto.randomUUID(), created = timestamp();
    await this.env.DB.prepare(`INSERT INTO neurons (id, space_id, name, color, text_content, key_points, memory_method, application, position_x, position_y, position_z, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(neuronId, spaceId, input.name, input.color, input.textContent ?? "", input.keyPoints ?? "", input.memoryMethod ?? "", input.application ?? "", input.positionX ?? 0, input.positionY ?? 0, input.positionZ ?? 0, created, created).run();
    return this.neuron(neuronId);
  }
  getNeuron(neuronId: string) { return this.neuron(neuronId); }
  async updateNeuron(neuronId: string, input: Record<string, unknown>) {
    await this.neuron(neuronId);
    const allowed: Record<string, string> = { name: "name", color: "color", textContent: "text_content", keyPoints: "key_points", memoryMethod: "memory_method", application: "application", positionX: "position_x", positionY: "position_y", positionZ: "position_z" };
    const fields = Object.entries(input).filter(([key]) => allowed[key]);
    if (!fields.length) throw new NeuronMindApiError(400, "VALIDATION_ERROR", "No supported fields were supplied");
    await this.env.DB.prepare(`UPDATE neurons SET ${fields.map(([key]) => `${allowed[key]} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).bind(...fields.map(([, value]) => value), timestamp(), neuronId).run();
    return this.neuron(neuronId);
  }
  async getNote(neuronId: string) {
    await this.neuron(neuronId);
    return (await this.env.DB.prepare("SELECT id, neuron_id AS neuronId, content, created_at AS createdAt, updated_at AS updatedAt FROM notes WHERE neuron_id = ?").bind(neuronId).first<Note>()) ?? { neuronId, content: null };
  }
  async saveNote(neuronId: string, content: string) {
    await this.neuron(neuronId); const created = timestamp();
    await this.env.DB.prepare(`INSERT INTO notes (id, neuron_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(neuron_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`).bind(crypto.randomUUID(), neuronId, content, created, created).run();
    return this.getNote(neuronId);
  }
  async search(query: string, limit: number): Promise<SearchResponse> {
    const pattern = likePattern(query);
    const rows = await this.env.DB.prepare(`SELECT n.id, 'neuron' AS type, n.name AS title, n.text_content AS snippet, n.id AS neuronId, s.id AS subjectId, s.name AS subjectName, n.updated_at AS updatedAt FROM neurons n JOIN spaces s ON s.id = n.space_id LEFT JOIN notes mn ON mn.neuron_id = n.id WHERE s.user_id = ? AND (n.name LIKE ? ESCAPE '\\' OR n.text_content LIKE ? ESCAPE '\\' OR mn.content LIKE ? ESCAPE '\\') ORDER BY n.updated_at DESC LIMIT ?`).bind(await this.owner(), pattern, pattern, pattern, limit).all<SearchResponse["results"][number]>();
    return { query, limit, results: rows.results };
  }
  async createConnection(spaceId: string, sourceNeuronId: string, targetNeuronId: string) {
    await this.space(spaceId);
    const neurons = await this.env.DB.prepare("SELECT id FROM neurons WHERE space_id = ? AND id IN (?, ?)").bind(spaceId, sourceNeuronId, targetNeuronId).all();
    if (neurons.results.length !== 2) throw new NeuronMindApiError(404, "NEURON_NOT_FOUND", "Both neurons must belong to the configured account and Space");
    const [source, target] = [sourceNeuronId, targetNeuronId].sort(), connectionId = crypto.randomUUID(), created = timestamp();
    try { await this.env.DB.prepare("INSERT INTO neuron_connections (id, space_id, source_neuron_id, target_neuron_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(connectionId, spaceId, source, target, created).run(); }
    catch (error) { if (String(error).includes("UNIQUE")) throw new NeuronMindApiError(409, "CONNECTION_ALREADY_EXISTS", "Connection already exists"); throw error; }
    return { id: connectionId, subjectId: spaceId, sourceNeuronId: source, targetNeuronId: target, createdAt: created };
  }
}
