import { downloadFromSupabase } from "../storage/supabase";

/**
 * Global presentation/content rules applied to every generated resume, stored
 * as a YAML file in the same Supabase bucket used for PDF export. Best-effort:
 * returns null if not configured or unreachable, rather than failing generation.
 */
export async function getUserRequirements(): Promise<string | null> {
  const bucket = process.env.SUPABASE_PDF_BUCKET;
  if (!bucket) return null;

  const path = process.env.SUPABASE_USER_REQUIREMENTS_PATH ?? "user_requirements.yaml";
  try {
    return await downloadFromSupabase(bucket, path);
  } catch (err) {
    console.error(`getUserRequirements: failed to load ${bucket}/${path}: ${String(err)}`);
    return null;
  }
}
