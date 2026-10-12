export type Env = {
  MCP_BEARER_TOKEN: string;
  NEURONMIND_API_URL: string;
  NEURONMIND_EMAIL: string;
  NEURONMIND_PASSWORD: string;
};

export type Space = {
  id: string;
  name: string;
  color: string | null;
  neuronCount?: number;
  connectionCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Neuron = {
  id: string;
  subjectId: string;
  name: string;
  color: string;
  textContent: string;
  note: string | null;
  keyPoints: string;
  memoryMethod: string;
  application: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id?: string;
  neuronId: string;
  content: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Connection = {
  id: string;
  subjectId: string;
  sourceNeuronId: string;
  targetNeuronId: string;
  createdAt: string;
};

export type SearchResponse = {
  query: string;
  limit: number;
  results: Array<{
    id: string;
    type: string;
    title: string;
    snippet: string;
    neuronId?: string;
    subjectId?: string;
    subjectName?: string;
    updatedAt?: string;
  }>;
};

type ErrorResponse = { error?: { code?: string; message?: string } };
type LoginResponse = { token: string };

export class NeuronMindApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "NeuronMindApiError";
  }
}

let cachedToken = "";
let cachedAccount = "";

export class NeuronMindApi {
  private readonly baseUrl: string;

  constructor(private readonly env: Env) {
    this.baseUrl = env.NEURONMIND_API_URL.replace(/\/$/, "");
  }

  private async login() {
    const account = `${this.baseUrl}\n${this.env.NEURONMIND_EMAIL}`;
    if (cachedToken && cachedAccount === account) return cachedToken;
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.env.NEURONMIND_EMAIL, password: this.env.NEURONMIND_PASSWORD }),
    });
    const data = await response.json().catch(() => ({})) as LoginResponse & ErrorResponse;
    if (!response.ok || !data.token) {
      throw new NeuronMindApiError(
        response.status,
        data.error?.code ?? "BACKEND_AUTH_FAILED",
        data.error?.message ?? "NeuronMind backend authentication failed",
      );
    }
    cachedAccount = account;
    cachedToken = data.token;
    return cachedToken;
  }

  async request<T>(path: string, init: RequestInit = {}, mayRetry = true): Promise<T> {
    const token = await this.login();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (response.status === 401 && mayRetry) {
      cachedToken = "";
      return this.request<T>(path, init, false);
    }
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => ({})) as T & ErrorResponse;
    if (!response.ok) {
      throw new NeuronMindApiError(
        response.status,
        data.error?.code ?? "BACKEND_REQUEST_FAILED",
        data.error?.message ?? `NeuronMind API returned HTTP ${response.status}`,
      );
    }
    return data;
  }

  listSpaces() { return this.request<Space[]>("/subjects"); }
  createSpace(input: { name: string; color: string }) {
    return this.request<Space>("/subjects", { method: "POST", body: JSON.stringify(input) });
  }
  listNeurons(spaceId: string) {
    return this.request<Neuron[]>(`/subjects/${encodeURIComponent(spaceId)}/neurons`);
  }
  createNeuron(spaceId: string, input: Record<string, unknown>) {
    return this.request<Neuron>(`/subjects/${encodeURIComponent(spaceId)}/neurons`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  getNeuron(neuronId: string) {
    return this.request<Neuron>(`/neurons/${encodeURIComponent(neuronId)}`);
  }
  updateNeuron(neuronId: string, input: Record<string, unknown>) {
    return this.request<Neuron>(`/neurons/${encodeURIComponent(neuronId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }
  getNote(neuronId: string) {
    return this.request<Note>(`/neurons/${encodeURIComponent(neuronId)}/note`);
  }
  saveNote(neuronId: string, content: string) {
    return this.request<Note>(`/neurons/${encodeURIComponent(neuronId)}/note`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }
  search(query: string, limit: number) {
    return this.request<SearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }
  createConnection(spaceId: string, sourceNeuronId: string, targetNeuronId: string) {
    return this.request<Connection>(`/subjects/${encodeURIComponent(spaceId)}/connections`, {
      method: "POST",
      body: JSON.stringify({ sourceNeuronId, targetNeuronId }),
    });
  }
}
