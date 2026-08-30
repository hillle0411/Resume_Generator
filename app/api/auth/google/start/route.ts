import { NextResponse } from "next/server";
import { buildAuthUrl } from "../../../../../lib/storage/googleOAuth";

export async function GET() {
  try {
    return NextResponse.redirect(buildAuthUrl());
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
