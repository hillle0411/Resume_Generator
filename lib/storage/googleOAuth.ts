import { OAuth2Client } from "google-auth-library";

const REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

function getClientCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set in environment");
  }
  return { clientId, clientSecret };
}

export function buildAuthUrl(): string {
  const { clientId } = getClientCredentials();
  const client = new OAuth2Client(clientId, undefined, REDIRECT_URI);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
  });
}

export async function exchangeCodeForRefreshToken(code: string): Promise<string> {
  const { clientId, clientSecret } = getClientCredentials();
  const client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned. Revoke this app's access at https://myaccount.google.com/permissions and try again (Google only issues a refresh_token on first consent)."
    );
  }
  return tokens.refresh_token;
}

export async function getOAuthAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getClientCredentials();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("GOOGLE_OAUTH_REFRESH_TOKEN not set in environment");

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to refresh Google OAuth access token");
  return token;
}
