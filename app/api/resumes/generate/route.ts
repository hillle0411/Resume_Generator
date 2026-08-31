import { NextResponse } from "next/server";
import { getAIProvider } from "../../../../lib/ai/index";
import { getUserRequirements } from "../../../../lib/ai/userRequirements";
import { getStorage } from "../../../../lib/storage/index";
import { v4 as uuidv4 } from "uuid";
import { ResumeSchema } from "../../../../lib/resume/schema";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormSubmit = !contentType.includes("application/json");

  try {
    let jobDescription: string;
    if (isFormSubmit) {
      const form = await request.formData();
      jobDescription = String(form.get("jobDescription") ?? "");
    } else {
      const body = await request.json();
      jobDescription = body.jobDescription;
    }

    if (!jobDescription) {
      if (isFormSubmit) return NextResponse.redirect(new URL("/?error=jobDescription+required", request.url), 303);
      return NextResponse.json({ error: "jobDescription required" }, { status: 400 });
    }

    const storage = getStorage();
    const master = await storage.getMasterDataBank();
    const userRequirements = await getUserRequirements();

    const ai = getAIProvider();
    const resume = await ai.generateResume(jobDescription, master, userRequirements);

    // Validate with zod
    const valid = ResumeSchema.parse(resume);

    const id = uuidv4();
    await storage.saveResume(id, valid);

    if (isFormSubmit) return NextResponse.redirect(new URL(`/resume/${id}`, request.url), 303);
    return NextResponse.json({ id });
  } catch (err: any) {
    const message = String(err?.message ?? err);
    if (isFormSubmit) return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, request.url), 303);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
