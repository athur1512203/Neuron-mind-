import { AppError } from "../utils/app-error";
import { readAIModel } from "./config";
import type { AIGenerateInput, AIGenerateResult, AIProvider } from "./types";

// Boundary only: no SDK, no HTTP, no API key requirement.
export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;

  async generate(_input: AIGenerateInput): Promise<AIGenerateResult> {
    readAIModel();
    throw new AppError(501, "OPENAI_PROVIDER_NOT_ENABLED", "OpenAI provider is not enabled");
  }
}
