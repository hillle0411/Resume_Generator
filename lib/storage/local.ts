import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { ResumeSchema, type Resume } from "../resume/schema";
import type { ResumeStorage, ResumeMeta } from "./types";

export class LocalFolderStorage implements ResumeStorage {
  private root: string;

  constructor() {
    const p = process.env.RESUME_FOLDER_PATH;
    if (!p) throw new Error("RESUME_FOLDER_PATH not set in environment");
    this.root = p;
  }

  private masterPath() {
    return path.join(this.root, "resume_master_bank.yaml");
  }

  private resumesDir() {
    return path.join(this.root, "resumes");
  }

  async getMasterDataBank(): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(this.masterPath(), "utf8");
      const parsed = yaml.load(content) as Record<string, unknown> | undefined;
      return parsed ?? {};
    } catch (err) {
      throw new Error(`resume_master_bank.yaml not found at RESUME_FOLDER_PATH (${this.root}) — check your .env.local`);
    }
  }

  async saveMasterDataBank(data: Record<string, unknown>): Promise<void> {
    try {
      const dump = yaml.dump(data as any);
      await fs.writeFile(this.masterPath(), dump, "utf8");
    } catch (err) {
      throw new Error(`Failed to write resume_master_bank.yaml at ${this.root}: ${String(err)}`);
    }
  }

  async listResumes(): Promise<ResumeMeta[]> {
    try {
      const dir = this.resumesDir();
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const metas: ResumeMeta[] = [];
      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!e.name.endsWith(".json")) continue;
        const id = e.name.replace(/\.json$/i, "");
        const full = path.join(dir, e.name);
        try {
          const stat = await fs.stat(full);
          const raw = await fs.readFile(full, "utf8");
          const parsed = JSON.parse(raw);
          metas.push({
            id,
            company: (parsed.company as string) || undefined,
            targetRole: (parsed.targetRole as string) || undefined,
            status: (parsed.status as string) || undefined,
            updatedAt: stat.mtime.toISOString(),
          });
        } catch (inner) {
          // skip malformed file but continue
          continue;
        }
      }
      return metas;
    } catch (err) {
      throw new Error(`Failed to list resumes in ${this.resumesDir()}: ${String(err)}`);
    }
  }

  async getResume(id: string): Promise<Resume> {
    try {
      const file = path.join(this.resumesDir(), `${id}.json`);
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      return ResumeSchema.parse(parsed);
    } catch (err) {
      throw new Error(`Failed to load resume ${id}: ${String(err)}`);
    }
  }

  async saveResume(id: string, data: Resume): Promise<void> {
    try {
      const file = path.join(this.resumesDir(), `${id}.json`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      // validate before saving
      const parsed = ResumeSchema.parse(data);
      await fs.writeFile(file, JSON.stringify(parsed, null, 2), "utf8");
    } catch (err) {
      throw new Error(`Failed to save resume ${id}: ${String(err)}`);
    }
  }

  async savePdf(id: string, pdfBuffer: Buffer): Promise<string> {
    try {
      const file = path.join(this.resumesDir(), `${id}.pdf`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, pdfBuffer);
      return file;
    } catch (err) {
      throw new Error(`Failed to save PDF for ${id}: ${String(err)}`);
    }
  }
}
