import { citationsFromContext, type AIGenerateInput, type AIGenerateResult, type AIProvider } from "./types";

export class MockAIProvider implements AIProvider {
  readonly name = "mock" as const;

  async generate(input: AIGenerateInput): Promise<AIGenerateResult> {
    const sources = citationsFromContext(input.context);
    if (!sources.length) {
      return {
        found: false,
        answer: null,
        sources: [],
        provider: this.name,
        model: "mock-v0",
      };
    }
    return {
      found: true,
      answer: `mock:${input.question}`,
      sources,
      provider: this.name,
      model: "mock-v0",
    };
  }
}
