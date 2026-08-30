import { NextResponse } from "next/server";
import { getAIProvider } from "../../../../lib/ai/index";
import { getStorage } from "../../../../lib/storage/index";
import { v4 as uuidv4 } from "uuid";
import { ResumeSchema } from "../../../../lib/resume/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jobDescription: string = body.jobDescription;
    if (!jobDescription) return NextResponse.json({ error: "jobDescription required" }, { status: 400 });

    const storage = getStorage();
    const master = await storage.getMasterDataBank();

    const ai = getAIProvider();
    const resume = await ai.generateResume(jobDescription, master);

    // Validate with zod
    const valid = ResumeSchema.parse(resume);

    const id = uuidv4();
    await storage.saveResume(id, valid);

    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
