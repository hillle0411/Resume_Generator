import { GoogleAuth } from "google-auth-library";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  }
  return cachedAuth;
}

export async function fetchDriveFileText(fileId: string): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error("Failed to obtain a Google access token");

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken.token}` },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "(no body)");
    throw new Error(`Google Drive fetch failed: HTTP ${resp.status}: ${text}`);
  }

  return resp.text();
}
