import { ClaudeProvider } from "./claude";
import type { AIProvider } from "./types";

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "claude";
  if (provider === "claude") {
    return new ClaudeProvider();
  }
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
