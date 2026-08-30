import React from "react";
import { getStorage } from "../lib/storage/index";

export default async function Page() {
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
      <p>
        To create a new resume, POST to <code>/api/resumes/generate</code> with JSON {"{ jobDescription }"}.
      </p>
    </main>
  );
}
