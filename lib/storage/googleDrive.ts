import { GoogleAuth } from "google-auth-library";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive"] });
  }
  return cachedAuth;
}

async function getAccessToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error("Failed to obtain a Google access token");
  return accessToken.token;
}

export async function fetchDriveFileText(fileId: string): Promise<string> {
  const token = await getAccessToken();

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "(no body)");
    throw new Error(`Google Drive fetch failed: HTTP ${resp.status}: ${text}`);
  }

  return resp.text();
}

/**
 * Uploads a file into a Drive folder. If a file with the same name already exists
 * directly in that folder, it's overwritten (updated) instead of duplicated.
 */
export async function uploadDriveFile(
  name: string,
  content: Buffer,
  folderId: string,
  mimeType: string
): Promise<{ id: string; webViewLink: string }> {
  const token = await getAccessToken();

  const existingId = await findFileInFolder(name, folderId, token);

  const boundary = "resume_gen_boundary";
  const metadata = existingId ? { name } : { name, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const multipartBody = Buffer.concat([Buffer.from(body, "utf8"), content, Buffer.from(closing, "utf8")]);

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`;

  const resp = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "(no body)");
    throw new Error(`Google Drive upload failed: HTTP ${resp.status}: ${text}`);
  }

  return resp.json();
}

async function findFileInFolder(name: string, folderId: string, token: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`);
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.files?.[0]?.id ?? null;
}
