interface Env {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

type Json = Record<string, unknown>;
type User = { id: string; email: string; createdAt: string; updatedAt: string };

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const encoder = new TextEncoder();
const COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOC_MAX = 50 * 1024 * 1024;
const NOTE_MAX = 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".md", ".zip", ".jpg", ".jpeg", ".png", ".webp"]);

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const bytes = (value: string) => encoder.encode(value).byteLength;
const likePattern = (value: string) => {
  let safe = "";
  for (const character of value.replace(/[\\%_]/g, "\\$&")) {
    if (bytes(safe + character) > 46) break;
    safe += character;
  }
  return `%${safe}%`;
};
const base64url = (input: ArrayBuffer | Uint8Array) => {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const decode64url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

function cors(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const allowed = !origin || origin === env.FRONTEND_URL || origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173";
  if (!allowed) throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed");
  return {
    "Access-Control-Allow-Origin": origin ?? env.FRONTEND_URL,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers });
}

function assertObject(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "VALIDATION_ERROR", "Expected a JSON object");
  return value as Json;
}

async function body(request: Request) {
  try { return assertObject(await request.json()); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }
}

function text(value: unknown, field: string, options: { optional?: boolean; nullable?: boolean; max?: number } = {}) {
  if (value === undefined && options.optional) return undefined;
  if (value === null && options.nullable) return null;
  if (typeof value !== "string") throw new HttpError(400, "VALIDATION_ERROR", `${field} must be a string`);
  const result = field === "name" || field === "email" ? value.trim() : value;
  if ((field === "name" || field === "email") && !result) throw new HttpError(400, "VALIDATION_ERROR", `${field} is required`);
  if (options.max && result.length > options.max) throw new HttpError(400, "VALIDATION_ERROR", `${field} is too long`);
  return result;
}

function finite(value: unknown, field: string, optional = true) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new HttpError(400, "VALIDATION_ERROR", `${field} must be a finite number`);
  return value;
}

// Workers Web Crypto supports at most 100,000 PBKDF2 iterations.
// Store the count with each password so login uses the same parameters.
async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 100000) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { hash: base64url(hash), salt: base64url(salt), iterations };
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(left)), crypto.subtle.digest("SHA-256", encoder.encode(right))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let mismatch = x.length ^ y.length;
  for (let index = 0; index < Math.max(x.length, y.length); index++) mismatch |= (x[index] ?? 0) ^ (y[index] ?? 0);
  return mismatch === 0;
}

async function jwt(userId: string, secret: string) {
  if (secret.length < 32) throw new HttpError(503, "SERVER_CONFIGURATION_ERROR", "JWT secret is not configured securely");
  const header = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(encoder.encode(JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 })));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(signature)}`;
}

async function authenticate(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3 || env.JWT_SECRET.length < 32) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, decode64url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new HttpError(401, "INVALID_TOKEN", "Invalid or expired token");
  let payload: { sub?: string; exp?: number };
  try { payload = JSON.parse(new TextDecoder().decode(decode64url(parts[1]))); }
  catch { throw new HttpError(401, "INVALID_TOKEN", "Invalid or expired token"); }
  if (!payload.sub || !payload.exp || payload.exp <= Date.now() / 1000) throw new HttpError(401, "INVALID_TOKEN", "Invalid or expired token");
  return payload.sub;
}

const subjectSelect = `id, user_id AS userId, name, color, created_at AS createdAt, updated_at AS updatedAt`;
const neuronSelect = `n.id, n.space_id AS subjectId, n.name, n.color, n.text_content AS textContent, n.note, n.key_points AS keyPoints, n.memory_method AS memoryMethod, n.application, n.position_x AS positionX, n.position_y AS positionY, n.position_z AS positionZ, n.created_at AS createdAt, n.updated_at AS updatedAt`;
const connectionSelect = `c.id, c.space_id AS subjectId, c.source_neuron_id AS sourceNeuronId, c.target_neuron_id AS targetNeuronId, c.created_at AS createdAt`;
const documentSelect = `d.id, d.space_id AS subjectId, d.original_name AS originalName, d.stored_name AS storedName, d.mime_type AS mimeType, d.extension, d.size, d.storage_key AS storageKey, d.checksum, d.created_at AS createdAt, d.updated_at AS updatedAt`;
const noteSelect = `mn.id, mn.neuron_id AS neuronId, mn.name, mn.content, mn.sort_order AS sortOrder, mn.is_default AS isDefault, mn.created_at AS createdAt, mn.updated_at AS updatedAt`;

async function ownedSpace(env: Env, spaceId: string, userId: string) {
  const row = await env.DB.prepare(`SELECT ${subjectSelect} FROM spaces WHERE id = ? AND user_id = ?`).bind(spaceId, userId).first();
  if (!row) throw new HttpError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  return row;
}

async function ownedNeuron(env: Env, neuronId: string, userId: string) {
  const row = await env.DB.prepare(`SELECT ${neuronSelect} FROM neurons n JOIN spaces s ON s.id = n.space_id WHERE n.id = ? AND s.user_id = ?`).bind(neuronId, userId).first();
  if (!row) throw new HttpError(404, "NEURON_NOT_FOUND", "Neuron not found");
  return row;
}

async function ownedNote(env: Env, noteId: string, userId: string) {
  const row = await env.DB.prepare(`SELECT ${noteSelect} FROM notes mn JOIN neurons n ON n.id = mn.neuron_id JOIN spaces s ON s.id = n.space_id WHERE mn.id = ? AND s.user_id = ?`).bind(noteId, userId).first();
  if (!row) throw new HttpError(404, "NOTE_NOT_FOUND", "Note not found");
  return row;
}

async function media(env: Env, neurons: Record<string, unknown>[]) {
  if (!neurons.length) return neurons.map((neuron) => ({ ...neuron, images: [], audio: [] }));
  const marks = neurons.map(() => "?").join(",");
  const ids = neurons.map((neuron) => neuron.id);
  const [images, audio] = await Promise.all([
    env.DB.prepare(`SELECT neuron_id AS neuronId, url FROM neuron_images WHERE neuron_id IN (${marks})`).bind(...ids).all(),
    env.DB.prepare(`SELECT neuron_id AS neuronId, url FROM neuron_audio WHERE neuron_id IN (${marks})`).bind(...ids).all(),
  ]);
  return neurons.map((neuron) => ({
    ...neuron,
    images: images.results.filter((item) => item.neuronId === neuron.id).map((item) => ({ url: item.url })),
    audio: audio.results.filter((item) => item.neuronId === neuron.id).map((item) => ({ url: item.url })),
  }));
}

async function authRoutes(request: Request, env: Env, path: string) {
  if (request.method === "POST" && path === "/auth/logout") return new Response(null, { status: 204 });
  if (request.method !== "POST" || (path !== "/auth/register" && path !== "/auth/login")) return null;
  const data = await body(request);
  const email = String(text(data.email, "email", { max: 254 })).toLowerCase();
  const password = text(data.password, "password", { max: 128 }) as string;
  if (!EMAIL.test(email) || password.length < 8) throw new HttpError(400, "VALIDATION_ERROR", "A valid email and password of at least 8 characters are required");
  if (path === "/auth/register") {
    const created = now(), userId = id();
    const token = await jwt(userId, env.JWT_SECRET);
    const passwordData = await hashPassword(password);
    try {
      await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(userId, email, passwordData.hash, passwordData.salt, passwordData.iterations, created, created).run();
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new HttpError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered");
      throw error;
    }
    const user: User = { id: userId, email, createdAt: created, updatedAt: created };
    return json({ token, user }, 201);
  }
  const row = await env.DB.prepare("SELECT id, email, password_hash AS passwordHash, password_salt AS passwordSalt, password_iterations AS passwordIterations, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE email = ? COLLATE NOCASE").bind(email).first<Record<string, unknown>>();
  if (!row) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  const candidate = await hashPassword(password, decode64url(String(row.passwordSalt)), Number(row.passwordIterations));
  if (!(await secureEqual(candidate.hash, String(row.passwordHash)))) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  const user: User = { id: String(row.id), email: String(row.email), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt) };
  return json({ token: await jwt(user.id, env.JWT_SECRET), user });
}

async function spaces(request: Request, env: Env, path: string, userId: string) {
  if (path === "/users/me" && request.method === "GET") {
    const user = await env.DB.prepare("SELECT id, email, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?").bind(userId).first();
    if (!user) throw new HttpError(401, "USER_NOT_FOUND", "User no longer exists");
    return json(user);
  }
  if (path === "/subjects" && request.method === "GET") {
    const result = await env.DB.prepare(`SELECT s.id, s.name, s.color, s.created_at AS createdAt, s.updated_at AS updatedAt, COUNT(DISTINCT n.id) AS neuronCount, COUNT(DISTINCT c.id) AS connectionCount FROM spaces s LEFT JOIN neurons n ON n.space_id = s.id LEFT JOIN neuron_connections c ON c.space_id = s.id WHERE s.user_id = ? GROUP BY s.id ORDER BY s.updated_at DESC`).bind(userId).all();
    return json(result.results);
  }
  if (path === "/subjects" && request.method === "POST") {
    const data = await body(request), name = text(data.name, "name", { max: 120 }) as string;
    const color = data.color === undefined ? null : text(data.color, "color", { max: 7 });
    if (color !== null && !COLOR.test(String(color))) throw new HttpError(400, "VALIDATION_ERROR", "Color must be a 6-digit hex value");
    const spaceId = id(), timestamp = now();
    await env.DB.prepare("INSERT INTO spaces (id, user_id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(spaceId, userId, name, color, timestamp, timestamp).run();
    return json({ id: spaceId, userId, name, color, createdAt: timestamp, updatedAt: timestamp }, 201);
  }
  const graph = path.match(/^\/subjects\/([^/]+)\/graph$/);
  if (graph && request.method === "GET") {
    const subject = await ownedSpace(env, decodeURIComponent(graph[1]), userId);
    const [neurons, connections] = await Promise.all([
      env.DB.prepare(`SELECT ${neuronSelect} FROM neurons n WHERE n.space_id = ? ORDER BY n.created_at`).bind(subject.id).all(),
      env.DB.prepare(`SELECT ${connectionSelect} FROM neuron_connections c WHERE c.space_id = ? ORDER BY c.created_at`).bind(subject.id).all(),
    ]);
    const counts = new Map<string, number>();
    for (const connection of connections.results) {
      for (const key of [String(connection.sourceNeuronId), String(connection.targetNeuronId)]) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const withMedia = await media(env, neurons.results);
    return json({ subject, neurons: withMedia.map((neuron) => ({ ...neuron, connectionCount: counts.get(String(neuron.id)) ?? 0 })), connections: connections.results });
  }
  const match = path.match(/^\/subjects\/([^/]+)$/);
  if (!match) return null;
  const spaceId = decodeURIComponent(match[1]), subject = await ownedSpace(env, spaceId, userId);
  if (request.method === "GET") {
    const counts = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM neurons WHERE space_id = ?) AS neuronCount, (SELECT COUNT(*) FROM neuron_connections WHERE space_id = ?) AS connectionCount").bind(spaceId, spaceId).first();
    return json({ ...subject, ...counts });
  }
  if (request.method === "PATCH") {
    const data = await body(request), updates: string[] = [], values: unknown[] = [];
    if (data.name !== undefined) { updates.push("name = ?"); values.push(text(data.name, "name", { max: 120 })); }
    if (data.color !== undefined) { const value = text(data.color, "color", { max: 7 }); if (!COLOR.test(String(value))) throw new HttpError(400, "VALIDATION_ERROR", "Color must be a 6-digit hex value"); updates.push("color = ?"); values.push(value); }
    if (!updates.length) throw new HttpError(400, "VALIDATION_ERROR", "At least one field is required");
    updates.push("updated_at = ?"); values.push(now(), spaceId);
    await env.DB.prepare(`UPDATE spaces SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return json(await ownedSpace(env, spaceId, userId));
  }
  if (request.method === "DELETE") {
    const docs = await env.DB.prepare("SELECT storage_key AS storageKey FROM documents WHERE space_id = ?").bind(spaceId).all();
    if (docs.results.length) await env.DOCUMENTS.delete(docs.results.map((item) => String(item.storageKey)));
    await env.DB.prepare("DELETE FROM spaces WHERE id = ?").bind(spaceId).run();
    return new Response(null, { status: 204 });
  }
  return null;
}

function neuronInput(data: Json, partial: boolean) {
  const out: Record<string, unknown> = {};
  const stringFields: Record<string, [string, number]> = { name: ["name", 120], color: ["color", 7], textContent: ["text_content", 100000], note: ["note", 100000], keyPoints: ["key_points", 100000], memoryMethod: ["memory_method", 100000], application: ["application", 100000] };
  for (const [field, [column, max]] of Object.entries(stringFields)) {
    if (data[field] !== undefined) out[column] = text(data[field], field, { optional: partial, nullable: field === "note", max });
  }
  if (!partial && (!out.name || !out.color)) throw new HttpError(400, "VALIDATION_ERROR", "name and color are required");
  if (out.color !== undefined && !COLOR.test(String(out.color))) throw new HttpError(400, "VALIDATION_ERROR", "Color must be a 6-digit hex value");
  for (const [field, column] of Object.entries({ positionX: "position_x", positionY: "position_y", positionZ: "position_z" })) {
    if (data[field] !== undefined) out[column] = finite(data[field], field);
  }
  return out;
}

async function neurons(request: Request, env: Env, path: string, userId: string) {
  const collection = path.match(/^\/subjects\/([^/]+)\/neurons$/);
  if (collection) {
    const spaceId = decodeURIComponent(collection[1]); await ownedSpace(env, spaceId, userId);
    if (request.method === "GET") {
      const rows = await env.DB.prepare(`SELECT ${neuronSelect} FROM neurons n WHERE n.space_id = ? ORDER BY n.created_at`).bind(spaceId).all();
      return json(await media(env, rows.results));
    }
    if (request.method === "POST") {
      const input = neuronInput(await body(request), false), neuronId = id(), timestamp = now();
      const columns = ["id", "space_id", ...Object.keys(input), "created_at", "updated_at"];
      const values = [neuronId, spaceId, ...Object.values(input), timestamp, timestamp];
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO neurons (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).bind(...values),
        env.DB.prepare("INSERT INTO notes (id, neuron_id, name, content, sort_order, is_default, created_at, updated_at) VALUES (?, ?, 'Ghi chú', '', 0, 1, ?, ?)").bind(id(), neuronId, timestamp, timestamp),
      ]);
      return json({ ...(await ownedNeuron(env, neuronId, userId)), images: [], audio: [] }, 201);
    }
  }
  const match = path.match(/^\/neurons\/([^/]+)$/);
  if (!match) return null;
  const neuronId = decodeURIComponent(match[1]), neuron = await ownedNeuron(env, neuronId, userId);
  if (request.method === "GET") return json((await media(env, [neuron]))[0]);
  if (request.method === "PATCH") {
    const input = neuronInput(await body(request), true), entries = Object.entries(input);
    if (!entries.length) throw new HttpError(400, "VALIDATION_ERROR", "At least one field is required");
    const timestamp = now();
    await env.DB.prepare(`UPDATE neurons SET ${entries.map(([key]) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).bind(...entries.map(([, value]) => value), timestamp, neuronId).run();
    await env.DB.prepare("UPDATE spaces SET updated_at = ? WHERE id = ?").bind(timestamp, neuron.subjectId).run();
    return json((await media(env, [await ownedNeuron(env, neuronId, userId)]))[0]);
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM neurons WHERE id = ?").bind(neuronId).run();
    return new Response(null, { status: 204 });
  }
  return null;
}

async function notes(request: Request, env: Env, path: string, userId: string) {
  const ordering = path.match(/^\/neurons\/([^/]+)\/notes\/order$/);
  if (ordering) {
    const neuronId = decodeURIComponent(ordering[1]); await ownedNeuron(env, neuronId, userId);
    if (request.method !== "PUT") return null;
    const noteIds = (await body(request)).noteIds;
    if (!Array.isArray(noteIds) || noteIds.some((value) => typeof value !== "string") || new Set(noteIds).size !== noteIds.length) {
      throw new HttpError(400, "VALIDATION_ERROR", "noteIds must contain unique note IDs");
    }
    const existing = await env.DB.prepare("SELECT id FROM notes WHERE neuron_id = ? ORDER BY sort_order, created_at").bind(neuronId).all<{ id: string }>();
    const expected = new Set(existing.results.map((item) => item.id));
    if (noteIds.length !== expected.size || noteIds.some((noteId) => !expected.has(noteId))) throw new HttpError(400, "VALIDATION_ERROR", "noteIds must include every note in the neuron");
    const timestamp = now();
    await env.DB.batch(noteIds.map((noteId, index) => env.DB.prepare("UPDATE notes SET sort_order = ?, updated_at = ? WHERE id = ?").bind(index, timestamp, noteId)));
    return json({ noteIds });
  }
  const collection = path.match(/^\/neurons\/([^/]+)\/notes$/);
  if (collection) {
    const neuronId = decodeURIComponent(collection[1]); await ownedNeuron(env, neuronId, userId);
    if (request.method === "GET") {
      const rows = await env.DB.prepare("SELECT id, neuron_id AS neuronId, name, sort_order AS sortOrder, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt FROM notes WHERE neuron_id = ? ORDER BY sort_order, created_at").bind(neuronId).all();
      return json(rows.results);
    }
    if (request.method === "POST") {
      const data = await body(request);
      const name = text(data.name ?? "Note mới", "name", { max: 120 }) as string;
      const timestamp = now(), noteId = id();
      const order = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM notes WHERE neuron_id = ?").bind(neuronId).first<{ nextOrder: number }>();
      await env.DB.prepare("INSERT INTO notes (id, neuron_id, name, content, sort_order, is_default, created_at, updated_at) VALUES (?, ?, ?, '', ?, 0, ?, ?)").bind(noteId, neuronId, name, order?.nextOrder ?? 0, timestamp, timestamp).run();
      return json(await ownedNote(env, noteId, userId), 201);
    }
    return null;
  }

  const legacy = path.match(/^\/neurons\/([^/]+)\/note$/);
  if (legacy) {
    const neuronId = decodeURIComponent(legacy[1]); await ownedNeuron(env, neuronId, userId);
    const current = () => env.DB.prepare(`SELECT ${noteSelect} FROM notes mn WHERE mn.neuron_id = ? ORDER BY mn.is_default DESC, mn.sort_order, mn.created_at LIMIT 1`).bind(neuronId).first();
    if (request.method === "GET") return json((await current()) ?? { neuronId, content: null });
    if (request.method === "PUT") {
      const content = text((await body(request)).content, "content") as string;
      if (bytes(content) > NOTE_MAX) throw new HttpError(413, "CONTENT_TOO_LARGE", "Rich-text content exceeds 1MB");
      const existing = await current(), timestamp = now();
      if (existing) await env.DB.prepare("UPDATE notes SET content = ?, updated_at = ? WHERE id = ?").bind(content, timestamp, existing.id).run();
      else await env.DB.prepare("INSERT INTO notes (id, neuron_id, name, content, sort_order, is_default, created_at, updated_at) VALUES (?, ?, 'Ghi chú', ?, 0, 1, ?, ?)").bind(id(), neuronId, content, timestamp, timestamp).run();
      return json(await current());
    }
    return null;
  }

  const item = path.match(/^\/notes\/([^/]+)$/); if (!item) return null;
  const noteId = decodeURIComponent(item[1]); const note = await ownedNote(env, noteId, userId);
  if (request.method === "GET") return json(note);
  if (request.method === "PUT") {
    const content = text((await body(request)).content, "content") as string;
    if (bytes(content) > NOTE_MAX) throw new HttpError(413, "CONTENT_TOO_LARGE", "Rich-text content exceeds 1MB");
    await env.DB.prepare("UPDATE notes SET content = ?, updated_at = ? WHERE id = ?").bind(content, now(), noteId).run();
    return json(await ownedNote(env, noteId, userId));
  }
  if (request.method === "PATCH") {
    const data = await body(request), updates: string[] = [], values: unknown[] = [];
    if (data.name !== undefined) { updates.push("name = ?"); values.push(text(data.name, "name", { max: 120 })); }
    if (data.sortOrder !== undefined) {
      const sortOrder = finite(data.sortOrder, "sortOrder", false) as number;
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new HttpError(400, "VALIDATION_ERROR", "sortOrder must be a non-negative integer");
      updates.push("sort_order = ?"); values.push(sortOrder);
    }
    if (!updates.length) throw new HttpError(400, "VALIDATION_ERROR", "At least one field is required");
    updates.push("updated_at = ?"); values.push(now(), noteId);
    await env.DB.prepare(`UPDATE notes SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return json(await ownedNote(env, noteId, userId));
  }
  if (request.method === "DELETE") {
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM notes WHERE neuron_id = ?").bind(note.neuronId).first<{ total: number }>();
    if ((count?.total ?? 0) <= 1) throw new HttpError(409, "LAST_NOTE_REQUIRED", "A neuron must keep at least one note");
    if (Number(note.isDefault) === 1) {
      const replacement = await env.DB.prepare("SELECT id FROM notes WHERE neuron_id = ? AND id <> ? ORDER BY sort_order, created_at LIMIT 1").bind(note.neuronId, noteId).first<{ id: string }>();
      if (!replacement) throw new HttpError(409, "LAST_NOTE_REQUIRED", "A neuron must keep at least one note");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(noteId),
        env.DB.prepare("UPDATE notes SET is_default = 1, updated_at = ? WHERE id = ?").bind(now(), replacement.id),
      ]);
    } else await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(noteId).run();
    return new Response(null, { status: 204 });
  }
  return null;
}

async function connections(request: Request, env: Env, path: string, userId: string) {
  const collection = path.match(/^\/subjects\/([^/]+)\/connections$/);
  if (collection) {
    const spaceId = decodeURIComponent(collection[1]); await ownedSpace(env, spaceId, userId);
    if (request.method === "GET") return json((await env.DB.prepare(`SELECT ${connectionSelect} FROM neuron_connections c WHERE c.space_id = ? ORDER BY c.created_at`).bind(spaceId).all()).results);
    if (request.method === "POST") {
      const data = await body(request), first = text(data.sourceNeuronId, "sourceNeuronId") as string, second = text(data.targetNeuronId, "targetNeuronId") as string;
      if (first === second) throw new HttpError(400, "SELF_CONNECTION_NOT_ALLOWED", "A neuron cannot connect to itself");
      const rows = await env.DB.prepare("SELECT id FROM neurons WHERE space_id = ? AND id IN (?, ?)").bind(spaceId, first, second).all();
      if (rows.results.length !== 2) throw new HttpError(404, "NEURON_NOT_FOUND", "Both neurons must exist in this subject");
      const [source, target] = [first, second].sort(), connectionId = id(), timestamp = now();
      try { await env.DB.prepare("INSERT INTO neuron_connections (id, space_id, source_neuron_id, target_neuron_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(connectionId, spaceId, source, target, timestamp).run(); }
      catch (error) { if (String(error).includes("UNIQUE")) throw new HttpError(409, "CONNECTION_ALREADY_EXISTS", "Connection already exists"); throw error; }
      return json({ id: connectionId, subjectId: spaceId, sourceNeuronId: source, targetNeuronId: target, createdAt: timestamp }, 201);
    }
  }
  const single = path.match(/^\/connections\/([^/]+)$/);
  if (single && request.method === "DELETE") {
    const connectionId = decodeURIComponent(single[1]);
    const owned = await env.DB.prepare("SELECT c.id FROM neuron_connections c JOIN spaces s ON s.id = c.space_id WHERE c.id = ? AND s.user_id = ?").bind(connectionId, userId).first();
    if (!owned) throw new HttpError(404, "CONNECTION_NOT_FOUND", "Connection not found");
    await env.DB.prepare("DELETE FROM neuron_connections WHERE id = ?").bind(connectionId).run();
    return new Response(null, { status: 204 });
  }
  return null;
}

function extension(name: string) { const index = name.lastIndexOf("."); return index < 0 ? "" : name.slice(index).toLowerCase(); }
async function documents(request: Request, env: Env, path: string, userId: string) {
  const collection = path.match(/^\/subjects\/([^/]+)\/documents$/);
  if (collection) {
    const spaceId = decodeURIComponent(collection[1]); await ownedSpace(env, spaceId, userId);
    if (request.method === "GET") return json((await env.DB.prepare(`SELECT ${documentSelect} FROM documents d WHERE d.space_id = ? ORDER BY d.created_at DESC`).bind(spaceId).all()).results.map(({ storageKey: _, checksum: __, ...item }) => item));
    if (request.method === "POST") {
      const form = await request.formData(), file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "VALIDATION_ERROR", "A file is required");
      const ext = extension(file.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) throw new HttpError(400, "UNSUPPORTED_FILE_TYPE", "Document type is not supported");
      if (!file.size || file.size > DOC_MAX) throw new HttpError(413, "FILE_TOO_LARGE", "Document exceeds the 50MB limit");
      const documentId = id(), storedName = `${documentId}${ext}`, storageKey = `${userId}/${spaceId}/${storedName}`, timestamp = now();
      await env.DOCUMENTS.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { originalName: file.name } });
      try {
        await env.DB.prepare("INSERT INTO documents (id, space_id, original_name, stored_name, mime_type, extension, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(documentId, spaceId, file.name, storedName, file.type || "application/octet-stream", ext, file.size, storageKey, timestamp, timestamp).run();
      } catch (error) { await env.DOCUMENTS.delete(storageKey); throw error; }
      return json({ id: documentId, subjectId: spaceId, originalName: file.name, storedName, mimeType: file.type || "application/octet-stream", extension: ext, size: file.size, createdAt: timestamp, updatedAt: timestamp }, 201);
    }
  }
  const single = path.match(/^\/documents\/([^/]+)(\/download)?$/); if (!single) return null;
  const documentId = decodeURIComponent(single[1]);
  const doc = await env.DB.prepare(`SELECT ${documentSelect} FROM documents d JOIN spaces s ON s.id = d.space_id WHERE d.id = ? AND s.user_id = ?`).bind(documentId, userId).first<Record<string, unknown>>();
  if (!doc) throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (single[2] && request.method === "GET") {
    const object = await env.DOCUMENTS.get(String(doc.storageKey)); if (!object) throw new HttpError(404, "DOCUMENT_FILE_NOT_FOUND", "Document file not found");
    const headers = new Headers({ "Content-Type": String(doc.mimeType), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(doc.originalName))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    return new Response(object.body, { headers });
  }
  if (!single[2] && request.method === "DELETE") {
    await env.DOCUMENTS.delete(String(doc.storageKey)); await env.DB.prepare("DELETE FROM documents WHERE id = ?").bind(documentId).run();
    return new Response(null, { status: 204 });
  }
  return null;
}

async function search(request: Request, env: Env, path: string, userId: string) {
  if (path === "/search/debug" && request.method === "POST") {
    const data = await body(request);
    const requests = Array.isArray(data.requests) ? data.requests.slice(0, 20) : [];
    const options = data.options && typeof data.options === "object" && !Array.isArray(data.options) ? data.options as Json : {};
    const maximum = Math.min(50, Math.max(1, Number(options.maxResultsPerRequest) || 20));
    const space = data.space && typeof data.space === "object" && !Array.isArray(data.space) ? data.space as Json : {};
    const neuron = data.neuron && typeof data.neuron === "object" && !Array.isArray(data.neuron) ? data.neuron as Json : {};
    const resolvedSpaceIds = typeof space.id === "string" ? [space.id] : [];
    const resolvedNeuronIds = typeof neuron.id === "string" ? [neuron.id] : [];
    const responses = [];
    const allSources = new Map<string, Json>();
    for (const raw of requests) {
      const item = assertObject(raw), requestId = String(item.id ?? ""), query = String(item.query ?? "").trim();
      if (!requestId || !query) { responses.push({ requestId, query, found: false, results: [] }); continue; }
      const pattern = likePattern(query);
      const rows = await env.DB.prepare(`SELECT n.id AS sourceId, 'NEURON' AS sourceType, n.id AS neuronId, s.id AS subjectId, s.name AS subjectName, n.name AS title, '' AS heading, n.text_content AS content, n.updated_at AS updatedAt FROM neurons n JOIN spaces s ON s.id = n.space_id WHERE s.user_id = ? AND (n.name LIKE ? ESCAPE '\\' OR n.text_content LIKE ? ESCAPE '\\') UNION ALL SELECT mn.id, 'MARKDOWN', n.id, s.id, s.name, mn.name, n.name, mn.content, mn.updated_at FROM notes mn JOIN neurons n ON n.id = mn.neuron_id JOIN spaces s ON s.id = n.space_id WHERE s.user_id = ? AND (mn.name LIKE ? ESCAPE '\\' OR mn.content LIKE ? ESCAPE '\\') UNION ALL SELECT d.id, 'DOCUMENT', '', s.id, s.name, d.original_name, '', d.mime_type, d.updated_at FROM documents d JOIN spaces s ON s.id = d.space_id WHERE s.user_id = ? AND d.original_name LIKE ? ESCAPE '\\' LIMIT ?`).bind(userId, pattern, pattern, userId, pattern, pattern, userId, pattern, maximum).all();
      const allowed = Array.isArray(item.sources) ? new Set(item.sources.map(String)) : null;
      const filtered = rows.results.filter((row) => (!allowed || allowed.has(String(row.sourceType))) && (!resolvedSpaceIds.length || resolvedSpaceIds.includes(String(row.subjectId))) && (!resolvedNeuronIds.length || resolvedNeuronIds.includes(String(row.neuronId))));
      const results = filtered.map((row, index) => {
        const result = { id: `${requestId}:${row.sourceType}:${row.sourceId}`, ...row, score: 1 / (index + 1), snippet: String(row.content).slice(0, 240), provenance: { sourceType: row.sourceType, sourceId: row.sourceId, subjectId: row.subjectId, neuronId: row.neuronId }, metadata: { updatedAt: row.updatedAt } };
        allSources.set(`${row.sourceType}:${row.sourceId}`, { sourceType: row.sourceType, sourceId: row.sourceId, subjectId: row.subjectId, neuronId: row.neuronId, title: row.title, provenance: result.provenance, metadata: result.metadata, subjectName: row.subjectName });
        return result;
      });
      responses.push({ requestId, query, found: results.length > 0, results });
    }
    return json({ plan: { resolvedSpaceIds, resolvedNeuronIds }, requests: responses, sources: [...allSources.values()] });
  }
  if (path !== "/search" || request.method !== "GET") return null;
  const url = new URL(request.url), query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20") || 20));
  if (!query) return json({ query, limit, results: [] });
  const pattern = likePattern(query);
  const rows = await env.DB.prepare(`
    SELECT n.id, 'neuron' AS type, n.name AS title, n.text_content AS snippet, n.id AS neuronId, s.id AS subjectId, s.name AS subjectName, n.updated_at AS updatedAt, 0 AS rank
    FROM neurons n JOIN spaces s ON s.id = n.space_id WHERE s.user_id = ? AND (n.name LIKE ? ESCAPE '\\' OR n.text_content LIKE ? ESCAPE '\\' OR n.key_points LIKE ? ESCAPE '\\' OR n.memory_method LIKE ? ESCAPE '\\' OR n.application LIKE ? ESCAPE '\\')
    UNION ALL
    SELECT mn.id, 'markdown', mn.name, substr(mn.content, 1, 500), n.id, s.id, s.name, mn.updated_at, 1
    FROM notes mn JOIN neurons n ON n.id = mn.neuron_id JOIN spaces s ON s.id = n.space_id WHERE s.user_id = ? AND (mn.name LIKE ? ESCAPE '\\' OR mn.content LIKE ? ESCAPE '\\')
    UNION ALL
    SELECT d.id, 'document', d.original_name, d.mime_type, NULL, s.id, s.name, d.updated_at, 2
    FROM documents d JOIN spaces s ON s.id = d.space_id WHERE s.user_id = ? AND d.original_name LIKE ? ESCAPE '\\'
    ORDER BY rank, updatedAt DESC LIMIT ?`).bind(userId, pattern, pattern, pattern, pattern, pattern, userId, pattern, pattern, userId, pattern, limit).all();
  return json({ query, limit, results: rows.results.map(({ rank: _, ...item }) => item) });
}

async function route(request: Request, env: Env) {
  const url = new URL(request.url), path = url.pathname.startsWith("/api") ? url.pathname.slice(4) || "/" : url.pathname;
  if (path === "/health" && request.method === "GET") return json({ status: "ok", searchDebug: true });
  const auth = await authRoutes(request, env, path); if (auth) return auth;
  const userId = await authenticate(request, env);
  for (const handler of [notes, documents, connections, neurons, spaces, search]) { const response = await handler(request, env, path, userId); if (response) return response; }
  throw new HttpError(404, "NOT_FOUND", "Route not found");
}

export default {
  async fetch(request: Request, env: Env) {
    let headers: HeadersInit;
    try { headers = cors(request, env); }
    catch (error) { const e = error as HttpError; return json({ error: { code: e.code, message: e.message } }, e.status); }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      const response = await route(request, env);
      const output = new Response(response.body, response);
      for (const [key, value] of Object.entries(headers)) output.headers.set(key, value);
      return output;
    } catch (error) {
      const known = error instanceof HttpError;
      if (!known) console.error("Unhandled API error", error instanceof Error ? error.message : "unknown");
      return json({ error: { code: known ? error.code : "INTERNAL_SERVER_ERROR", message: known ? error.message : "Internal server error" } }, known ? error.status : 500, headers);
    }
  },
} satisfies ExportedHandler<Env>;
