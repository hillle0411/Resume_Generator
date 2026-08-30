import { ResumeSchema, type Resume } from "../resume/schema";
import type { AIProvider } from "./types";

function extractJson(content: string): string {
  const trimmed = content.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

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
    const template = {
      name: "string",
      targetRole: "string (optional)",
      contact: { location: "string (optional)", email: "string (optional)", linkedin: "string (optional)" },
      summary: "string (optional)",
      experience: [{ title: "string", company: "string", dates: "string", bullets: ["string"] }],
      education: [{ degree: "string", institution: "string", dates: "string" }],
      skills: ["string"],
    };

    const system = `You are a resume-writing assistant. Return ONLY valid JSON matching EXACTLY this shape (same keys, same nesting, "skills" is a flat array of strings, not grouped by category):
${JSON.stringify(template, null, 2)}

Do not include any explanation, markdown fences, comments, or extra fields. Do not rename any key.`;
    const user = `Master bank:\n${JSON.stringify(masterBank)}\n\nJob description:\n${jobDescription}\n\nReturn a JSON object matching the exact shape above, using the master bank data tailored to the job description.`;

    try {
      const body = {
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 4000),
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

      const cleaned = extractJson(content);
      const parsed = JSON.parse(cleaned);
      const valid = ResumeSchema.parse(parsed);
      return valid;
    } catch (err: any) {
      throw new Error(`OpenRouterProvider failed to generate a valid resume: ${String(err?.message ?? err)}`);
    }
  }
}
