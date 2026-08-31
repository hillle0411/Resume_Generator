import type { Resume } from "../resume/schema";

export interface AIProvider {
  generateResume(jobDescription: string, masterBank: Record<string, unknown>, userRequirements?: string | null): Promise<Resume>;
}
