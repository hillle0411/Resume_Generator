import { Anthropic } from "@anthropic-ai/sdk";
import { ResumeSchema, type Resume } from "../resume/schema";
import type { AIProvider } from "./types";

export class ClaudeProvider implements AIProvider {
  private client: any;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set in environment");
    this.client = new Anthropic({ apiKey: key });
  }

  async generateResume(jobDescription: string, masterBank: Record<string, unknown>): Promise<Resume> {
    // Compose a prompt instructing Claude to return only JSON matching the ResumeSchema
    const system = `You are a resume-writing assistant. Return ONLY valid JSON that conforms exactly to the provided Resume schema. Do not include any explanation, markdown fences, or extra fields.`;

    const user = `Master bank:\n${JSON.stringify(masterBank)}\n\nJob description:\n${jobDescription}\n\nReturn a JSON object matching the Resume schema.`;

    try {
      // The exact SDK call shape may vary; this is a straightforward completion request
      const response = await this.client.complete({
        model: "claude-2",
        prompt: system + "\n" + user,
        max_tokens: 1500,
      });

      const text = response?.completion ?? response?.text ?? String(response);
      const cleaned = text.trim();

      // Try to parse JSON out of the response. The model is instructed to return raw JSON only.
      const parsed = JSON.parse(cleaned);
      const valid = ResumeSchema.parse(parsed);
      return valid;
    } catch (err) {
      throw new Error(`ClaudeProvider failed to generate a valid resume: ${String(err)}`);
    }
  }
}
