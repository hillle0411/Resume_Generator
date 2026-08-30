import { createClient } from "@supabase/supabase-js";

let cachedClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!cachedClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in environment");
    cachedClient = createClient(url, key);
  }
  return cachedClient;
}

export async function uploadToSupabase(bucket: string, path: string, content: Buffer, mimeType: string): Promise<string> {
  const client = getClient();
  const { error } = await client.storage.from(bucket).upload(path, content, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function downloadFromSupabase(bucket: string, path: string): Promise<string> {
  const client = getClient();
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  return data.text();
}

export async function listSupabaseFiles(bucket: string, prefix: string): Promise<{ name: string; updatedAt: string }[]> {
  const client = getClient();
  const { data, error } = await client.storage.from(bucket).list(prefix);
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return data.map((f) => ({ name: f.name, updatedAt: f.updated_at ?? new Date().toISOString() }));
}
