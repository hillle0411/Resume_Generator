import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { ResumeSchema, type Resume } from "../resume/schema";
import type { ResumeStorage, ResumeMeta } from "./types";
import { fetchDriveFileText, uploadDriveFile } from "./googleDrive";
import { getOAuthAccessToken } from "./googleOAuth";
import { uploadToSupabase, downloadFromSupabase, listSupabaseFiles } from "./supabase";

export class LocalFolderStorage implements ResumeStorage {
  private root?: string;

  constructor() {
    this.root = process.env.RESUME_FOLDER_PATH;
  }

  private requireRoot(): string {
    if (!this.root) throw new Error("RESUME_FOLDER_PATH not set in environment");
    return this.root;
  }

  private masterPath() {
    return path.join(this.requireRoot(), "resume_master_bank.yaml");
  }

  private resumesDir() {
    return path.join(this.requireRoot(), "resumes");
  }

  async getMasterDataBank(): Promise<Record<string, unknown>> {
    const source = process.env.MASTER_BANK_SOURCE ?? "local";
    try {
      let content: string;
      if (source === "drive") {
        const fileId = process.env.GOOGLE_DRIVE_MASTER_BANK_FILE_ID;
        if (!fileId) throw new Error("GOOGLE_DRIVE_MASTER_BANK_FILE_ID not set in environment");
        content = await fetchDriveFileText(fileId);
      } else if (source === "supabase") {
        const bucket = process.env.SUPABASE_MASTER_BANK_BUCKET;
        const filePath = process.env.SUPABASE_MASTER_BANK_PATH;
        if (!bucket || !filePath) {
          throw new Error("SUPABASE_MASTER_BANK_BUCKET / SUPABASE_MASTER_BANK_PATH not set in environment");
        }
        content = await downloadFromSupabase(bucket, filePath);
      } else {
        content = await fs.readFile(this.masterPath(), "utf8");
      }
      const parsed = yaml.load(content) as Record<string, unknown> | undefined;
      return parsed ?? {};
    } catch (err) {
      const where =
        source === "drive"
          ? `Google Drive file ${process.env.GOOGLE_DRIVE_MASTER_BANK_FILE_ID}`
          : source === "supabase"
          ? `Supabase ${process.env.SUPABASE_MASTER_BANK_BUCKET}/${process.env.SUPABASE_MASTER_BANK_PATH}`
          : this.masterPath();
      throw new Error(`Failed to load resume_master_bank.yaml from ${where}: ${String(err)}`);
    }
  }

  async saveMasterDataBank(data: Record<string, unknown>): Promise<void> {
    const source = process.env.MASTER_BANK_SOURCE ?? "local";
    if (source === "drive" || source === "supabase") {
      throw new Error(`Saving the master data bank is not supported when MASTER_BANK_SOURCE=${source}`);
    }
    try {
      const dump = yaml.dump(data as any);
      await fs.writeFile(this.masterPath(), dump, "utf8");
    } catch (err) {
      throw new Error(`Failed to write resume_master_bank.yaml at ${this.root}: ${String(err)}`);
    }
  }

  private resumesBucket(): string {
    const bucket = process.env.SUPABASE_RESUMES_BUCKET;
    if (!bucket) throw new Error("SUPABASE_RESUMES_BUCKET not set in environment");
    return bucket;
  }

  async listResumes(): Promise<ResumeMeta[]> {
    const target = process.env.RESUME_STORAGE_TARGET ?? "local";
    try {
      if (target === "supabase") {
        const bucket = this.resumesBucket();
        const files = await listSupabaseFiles(bucket, "resumes");
        const metas: ResumeMeta[] = [];
        for (const f of files) {
          if (!f.name.endsWith(".json")) continue;
          const id = f.name.replace(/\.json$/i, "");
          try {
            const raw = await downloadFromSupabase(bucket, `resumes/${f.name}`);
            const parsed = JSON.parse(raw);
            metas.push({
              id,
              company: (parsed.company as string) || undefined,
              targetRole: (parsed.targetRole as string) || undefined,
              status: (parsed.status as string) || undefined,
              updatedAt: f.updatedAt,
            });
          } catch (inner) {
            continue;
          }
        }
        return metas;
      }

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
      throw new Error(`Failed to list resumes (target=${target}): ${String(err)}`);
    }
  }

  async getResume(id: string): Promise<Resume> {
    const target = process.env.RESUME_STORAGE_TARGET ?? "local";
    try {
      let raw: string;
      if (target === "supabase") {
        raw = await downloadFromSupabase(this.resumesBucket(), `resumes/${id}.json`);
      } else {
        const file = path.join(this.resumesDir(), `${id}.json`);
        raw = await fs.readFile(file, "utf8");
      }
      const parsed = JSON.parse(raw);
      return ResumeSchema.parse(parsed);
    } catch (err) {
      throw new Error(`Failed to load resume ${id} (target=${target}): ${String(err)}`);
    }
  }

  async saveResume(id: string, data: Resume): Promise<void> {
    const target = process.env.RESUME_STORAGE_TARGET ?? "local";
    try {
      // validate before saving
      const parsed = ResumeSchema.parse(data);
      const json = JSON.stringify(parsed, null, 2);

      if (target === "supabase") {
        await uploadToSupabase(this.resumesBucket(), `resumes/${id}.json`, Buffer.from(json, "utf8"), "application/json");
        return;
      }

      const file = path.join(this.resumesDir(), `${id}.json`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, json, "utf8");
    } catch (err) {
      throw new Error(`Failed to save resume ${id} (target=${target}): ${String(err)}`);
    }
  }

  async savePdf(id: string, pdfBuffer: Buffer): Promise<string> {
    const target = process.env.PDF_EXPORT_TARGET ?? "local";
    try {
      if (target === "drive") {
        const folderId = process.env.GOOGLE_DRIVE_PDF_FOLDER_ID;
        if (!folderId) throw new Error("GOOGLE_DRIVE_PDF_FOLDER_ID not set in environment");
        const token = await getOAuthAccessToken();
        const uploaded = await uploadDriveFile(token, `${id}.pdf`, pdfBuffer, folderId, "application/pdf");
        return uploaded.webViewLink;
      }

      if (target === "supabase") {
        const bucket = process.env.SUPABASE_PDF_BUCKET;
        if (!bucket) throw new Error("SUPABASE_PDF_BUCKET not set in environment");
        return await uploadToSupabase(bucket, `${id}.pdf`, pdfBuffer, "application/pdf");
      }

      const file = path.join(this.resumesDir(), `${id}.pdf`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, pdfBuffer);
      return file;
    } catch (err) {
      throw new Error(`Failed to save PDF for ${id} (target=${target}): ${String(err)}`);
    }
  }
}
