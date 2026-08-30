import type { Resume } from "../resume/schema";

export interface ResumeMeta {
  id: string;
  company?: string;
  targetRole?: string;
  status?: string;
  updatedAt: string; // ISO date
}

export interface ResumeStorage {
  getMasterDataBank(): Promise<Record<string, unknown>>;
  saveMasterDataBank(data: Record<string, unknown>): Promise<void>;

  listResumes(): Promise<ResumeMeta[]>;
  getResume(id: string): Promise<Resume>;
  saveResume(id: string, data: Resume): Promise<void>;

  savePdf(id: string, pdfBuffer: Buffer): Promise<string>;
}
