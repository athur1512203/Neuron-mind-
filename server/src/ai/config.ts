import type { AIProviderName } from "./types";

// Missing AI_PROVIDER must not crash the process. Unknown values fail closed to local.
export function readAIProviderName(env: NodeJS.ProcessEnv = process.env): AIProviderName {
  const raw = env.AI_PROVIDER?.trim().toLowerCase();
  if (raw === "mock" || raw === "openai") return raw;
  return "local";
}

export function readAIModel(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const model = env.AI_MODEL?.trim();
  return model || undefined;
}
