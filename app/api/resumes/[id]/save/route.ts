import { NextResponse } from "next/server";
import { getStorage } from "../../../../../lib/storage/index";
import { ResumeSchema } from "../../../../../lib/resume/schema";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const contentType = request.headers.get("content-type") || "";
  const isFormSubmit = !contentType.includes("application/json");

  try {
    let body: any;
    if (isFormSubmit) {
      const fd = await request.formData();
      body = { content: fd.get("content") };
    } else {
      body = await request.json();
    }

    if (!body?.content) {
      if (isFormSubmit) return NextResponse.redirect(new URL(`/resume/${id}?error=content+required`, request.url), 303);
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const parsed = JSON.parse(String(body.content));
    const valid = ResumeSchema.parse(parsed);

    const storage = getStorage();
    await storage.saveResume(id, valid);

    if (isFormSubmit) return NextResponse.redirect(new URL(`/resume/${id}?saved=1`, request.url), 303);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = String(err?.message ?? err);
    if (isFormSubmit) return NextResponse.redirect(new URL(`/resume/${id}?error=${encodeURIComponent(message)}`, request.url), 303);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
