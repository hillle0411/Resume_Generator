import { NextResponse } from "next/server";
import { exchangeCodeForRefreshToken } from "../../../../../lib/storage/googleOAuth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(`<p>Google denied authorization: ${error}</p>`, {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }
  if (!code) {
    return new NextResponse("<p>Missing ?code in callback URL.</p>", {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const refreshToken = await exchangeCodeForRefreshToken(code);
    return new NextResponse(
      `<p>Authorization succeeded. Copy this value into <code>.env.local</code> as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>, then restart the dev server:</p>` +
        `<pre style="white-space: pre-wrap; word-break: break-all; padding: 12px; background: #eee;">${refreshToken}</pre>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err: any) {
    return new NextResponse(`<pre>${String(err?.message ?? err)}</pre>`, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
