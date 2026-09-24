import { apiRequest, setToken } from "./client";
import type { ApiUser } from "./mappers";

export type AuthResponse = {
  token: string;
  user: ApiUser;
};

export async function register(email: string, password: string) {
  const data = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export async function login(email: string, password: string) {
  const data = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export function getMe() {
  return apiRequest<ApiUser>("/users/me");
}
