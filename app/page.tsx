import React from "react";
import { getStorage } from "../lib/storage/index";

type Props = { searchParams: { error?: string } };

export default async function Page({ searchParams }: Props) {
  const storage = getStorage();
  const resumes = await storage.listResumes();

  return (
    <main style={{ padding: 24 }}>
      <h1>Resume dashboard</h1>
      <p>Existing resumes:</p>
      <ul>
        {resumes.map((r) => (
          <li key={r.id}>
            <a href={`/resume/${r.id}`}>{r.id}</a> — {r.company ?? "—"} — {r.targetRole ?? "—"}{" "}
            — {new Date(r.updatedAt).toLocaleString()}
          </li>
        ))}
      </ul>

      <h2>Generate a new resume</h2>
      {searchParams.error && <p style={{ color: "red" }}>{searchParams.error}</p>}
      <form method="post" action="/api/resumes/generate">
        <textarea name="jobDescription" rows={10} cols={80} placeholder="Paste job description here..." required />
        <br />
        <button type="submit">Generate resume</button>
      </form>
    </main>
  );
}
