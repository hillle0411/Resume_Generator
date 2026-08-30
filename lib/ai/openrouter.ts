import { ResumeSchema, type Resume } from "../resume/schema";
import type { AIProvider } from "./types";

export class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private endpoint = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY not set in environment");
    this.apiKey = key;
    this.model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  }

  async generateResume(jobDescription: string, masterBank: Record<string, unknown>): Promise<Resume> {
    const system = `You are a resume-writing assistant. Return ONLY valid JSON that conforms exactly to the provided Resume schema. Do not include any explanation, markdown fences, or extra fields.`;
    const user = `Master bank:\n${JSON.stringify(masterBank)}\n\nJob description:\n${jobDescription}\n\nReturn a JSON object matching the Resume schema.`;

    try {
      const body = {
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 1500,
      } as any;

      const resp = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "(no body)");
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }

      const json = await resp.json();
      // OpenRouter follows OpenAI response shape: choices[0].message.content
      const content = json?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("No content field in OpenRouter response");
      }

      const cleaned = content.trim();
      const parsed = JSON.parse(cleaned);
      const valid = ResumeSchema.parse(parsed);
      return valid;
    } catch (err: any) {
      throw new Error(`OpenRouterProvider failed to generate a valid resume: ${String(err?.message ?? err)}`);
    }
  }
}
