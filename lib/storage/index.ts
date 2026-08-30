import { LocalFolderStorage } from "./local";
import type { ResumeStorage } from "./types";

export function getStorage(): ResumeStorage {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "local") {
    return new LocalFolderStorage();
  }
  throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
}
