import { NextResponse } from "next/server";
import { getStorage } from "../../../../../lib/storage/index";
import { ResumeSchema } from "../../../../../lib/resume/schema";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any;
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      // try form data
      const fd = await request.formData();
      body = { content: fd.get("content") };
    }

    if (!body?.content) return NextResponse.json({ error: "content required" }, { status: 400 });

    const parsed = JSON.parse(String(body.content));
    const valid = ResumeSchema.parse(parsed);

    const storage = getStorage();
    await storage.saveResume(id, valid);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
