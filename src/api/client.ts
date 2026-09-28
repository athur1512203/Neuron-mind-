export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = "neuromind_token";

let onUnauthorized: (() => void) | null = null;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function apiBase() {
  const base = import.meta.env.VITE_API_URL;
  if (!base) {
    throw new ApiError(500, "MISSING_API_URL", "VITE_API_URL is not configured");
  }
  return base.replace(/\/$/, "");
}

export function apiUrl(path: string) {
  return `${apiBase()}${path}`;
}

type ErrorBody = {
  error?: { code?: string; message?: string };
};

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("Content-Type") && init.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(apiUrl(path), { ...init, headers });

  if (response.status === 401 && !path.startsWith("/auth/")) {
    clearToken();
    onUnauthorized?.();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => ({}))) as T & ErrorBody;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code ?? "REQUEST_FAILED",
      data.error?.message ?? "Request failed",
    );
  }

  return data;
}

export function apiMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
