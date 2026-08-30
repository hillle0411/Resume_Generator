import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { ResumeSchema, type Resume } from "../resume/schema";
import type { ResumeStorage, ResumeMeta } from "./types";
import { fetchDriveFileText, uploadDriveFile } from "./googleDrive";
import { getOAuthAccessToken } from "./googleOAuth";
import { uploadToSupabase } from "./supabase";

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
    const source = process.env.MASTER_BANK_SOURCE ?? "local";
    try {
      let content: string;
      if (source === "drive") {
        const fileId = process.env.GOOGLE_DRIVE_MASTER_BANK_FILE_ID;
        if (!fileId) throw new Error("GOOGLE_DRIVE_MASTER_BANK_FILE_ID not set in environment");
        content = await fetchDriveFileText(fileId);
      } else {
        content = await fs.readFile(this.masterPath(), "utf8");
      }
      const parsed = yaml.load(content) as Record<string, unknown> | undefined;
      return parsed ?? {};
    } catch (err) {
      const where = source === "drive" ? `Google Drive file ${process.env.GOOGLE_DRIVE_MASTER_BANK_FILE_ID}` : this.masterPath();
      throw new Error(`Failed to load resume_master_bank.yaml from ${where}: ${String(err)}`);
    }
  }

  async saveMasterDataBank(data: Record<string, unknown>): Promise<void> {
    if ((process.env.MASTER_BANK_SOURCE ?? "local") === "drive") {
      throw new Error("Saving the master data bank is not supported when MASTER_BANK_SOURCE=drive");
    }
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
        return await uploadToSupabase(`${id}.pdf`, pdfBuffer, "application/pdf");
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
