import React from "react";
import { getStorage } from "../../../lib/storage/index";
import { ResumeSchema } from "../../../lib/resume/schema";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export default async function ResumePage({ params }: Props) {
  const { id } = params;
  const storage = getStorage();
  const resume = await storage.getResume(id);

  return (
    <main style={{ padding: 24 }}>
      <h1>Editor — {id}</h1>
      <p>Basic JSON editor (replace with CodeMirror on the client):</p>
      <form method="post" action={`/api/resumes/${id}/save`}>
        <textarea name="content" defaultValue={JSON.stringify(resume, null, 2)} rows={20} cols={80} />
        <br />
        <button type="submit">Save</button>
      </form>
      <form method="post" action={`/api/resumes/${id}/export`}>
        <button type="submit">Export PDF</button>
      </form>
    </main>
  );
}
