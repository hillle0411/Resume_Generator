import { OpenRouterProvider } from "./openrouter";
import type { AIProvider } from "./types";

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "openrouter";
  if (provider === "openrouter") {
    return new OpenRouterProvider();
  }
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
