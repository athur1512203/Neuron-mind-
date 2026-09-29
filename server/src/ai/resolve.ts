import { MockAIProvider } from "./mock.provider";
import { readAIProviderName } from "./config";
import type { AIProvider } from "./types";

// Production default is local retrieval (null provider). OpenAI is reserved and not constructed.
export function resolveAIProvider(env: NodeJS.ProcessEnv = process.env): AIProvider | null {
  if (readAIProviderName(env) === "mock") return new MockAIProvider();
  return null;
}
