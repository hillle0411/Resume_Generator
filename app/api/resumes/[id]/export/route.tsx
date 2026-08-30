import { NextResponse } from "next/server";
import { getStorage } from "../../../../../lib/storage/index";
import ResumeDocument from "../../../../../lib/resume/ResumeDocument";
import { renderToStream, renderToBuffer } from "@react-pdf/renderer";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const storage = getStorage();
    const resume = await storage.getResume(id as string);

    // render to buffer
    const buffer = await renderToBuffer(<ResumeDocument resume={resume} />);

    const savedPath = await storage.savePdf(id, buffer);

    return NextResponse.json({ path: savedPath });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
