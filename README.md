# Resume Generator (Next.js)

This repository contains a prototype Next.js + TypeScript application that generates, edits, and exports resumes as PDFs using an AI provider and a pluggable storage backend.

The code is intentionally structured so that the storage layer and AI provider are isolated behind interfaces. Replacing a provider later should be a matter of adding a new implementation that satisfies the interface and flipping an environment variable — no UI, API route, or PDF code should import `fs`, `js-yaml`, or any AI SDK directly.

Contents
- [Project files](#project-files)
- [Quick start](#quick-start)
- [Folder structure](#folder-structure)
- [Environment variables](#environment-variables)
- [Storage provider](#storage-provider)
- [AI provider](#ai-provider)
- [API routes and pages](#api-routes-and-pages)
- [Extending the app](#extending-the-app)
- [Notes & caveats](#notes--caveats)

Project files
- [package.json](C:/Users/84983/Desktop/Resume_Generator/package.json)
- [tsconfig.json](C:/Users/84983/Desktop/Resume_Generator/tsconfig.json)
- [next.config.js](C:/Users/84983/Desktop/Resume_Generator/next.config.js)
- Code of interest:
  - Storage: [lib/storage/types.ts](C:/Users/84983/Desktop/Resume_Generator/lib/storage/types.ts), [lib/storage/local.ts](C:/Users/84983/Desktop/Resume_Generator/lib/storage/local.ts)
  - AI: [lib/ai/types.ts](C:/Users/84983/Desktop/Resume_Generator/lib/ai/types.ts), [lib/ai/openrouter.ts](C:/Users/84983/Desktop/Resume_Generator/lib/ai/openrouter.ts)
  - Resume schema & PDF template: [lib/resume/schema.ts](C:/Users/84983/Desktop/Resume_Generator/lib/resume/schema.ts), [lib/resume/ResumeDocument.tsx](C:/Users/84983/Desktop/Resume_Generator/lib/resume/ResumeDocument.tsx)
  - Pages & API routes: [app/page.tsx](C:/Users/84983/Desktop/Resume_Generator/app/page.tsx), [app/resume/[id]/page.tsx](C:/Users/84983/Desktop/Resume_Generator/app/resume/[id]/page.tsx), [app/api/resumes/generate/route.ts](C:/Users/84983/Desktop/Resume_Generator/app/api/resumes/generate/route.ts)

Quick start
1. Install dependencies
   - Open a terminal in the project root (C:\Users\84983\Desktop\Resume_Generator) and run:
     npm install

2. Configure environment
   - Create a `.env.local` file in the project root (do not commit it). Example contents:
     RESUME_FOLDER_PATH=C:\absolute\path\to\ResumeFolder
     STORAGE_PROVIDER=local
     AI_PROVIDER=openrouter
     OPENROUTER_API_KEY=sk-or-...
     OPENROUTER_MODEL=openai/gpt-4o-mini

   - The `RESUME_FOLDER_PATH` should point to a folder outside the repository. The expected layout inside that folder is:
     - resume_master_bank.yaml
     - resumes/ (directory)
       - <id>.json
       - <id>.pdf

   - Create the folder and an initial `resume_master_bank.yaml` (can be an empty YAML object: `{}`).

2a. (Optional) Read the master data bank from Google Drive instead of the local file
   - This lets you keep `resume_master_bank.yaml` in a Google Drive folder as the source of truth,
     while resumes and PDFs still save locally under `RESUME_FOLDER_PATH`.
   - One-time Google Cloud setup:
     1. Create (or reuse) a project at https://console.cloud.google.com/, enable the **Google Drive API** for it.
     2. Create a **Service Account** (IAM & Admin → Service Accounts), then create a JSON key for it and download it.
     3. Open the master bank file in Google Drive, click **Share**, and share it with the service account's
        email address (looks like `something@your-project.iam.gserviceaccount.com`) as **Viewer**.
     4. Get the file's ID from its Drive URL: `https://drive.google.com/file/d/<FILE_ID>/view`.
   - Add to `.env.local`:
     MASTER_BANK_SOURCE=drive
     GOOGLE_APPLICATION_CREDENTIALS=C:\absolute\path\to\service-account-key.json
     GOOGLE_DRIVE_MASTER_BANK_FILE_ID=<FILE_ID from the Drive URL>
   - Notes:
     - `GOOGLE_APPLICATION_CREDENTIALS` is the standard env var Google's auth library reads automatically —
       don't rename it.
     - When `MASTER_BANK_SOURCE=drive`, the master bank is read-only from the app's perspective; there's
       currently no route that edits it anyway.
     - Leave `MASTER_BANK_SOURCE` unset (or `local`) to keep using the local `resume_master_bank.yaml` file.

2b. (Optional) Export generated PDFs to a Google Drive folder instead of locally
   - Uses the same service account as 2a (widen its Drive share instead of setting up a second one).
   - One-time setup:
     1. In Google Drive, create (or pick) a folder to receive exported PDFs.
     2. Share that folder with the service account's email address as **Editor** (it needs write access,
        unlike the read-only master bank file).
     3. Get the folder's ID from its Drive URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`.
   - Add to `.env.local`:
     PDF_EXPORT_TARGET=drive
     GOOGLE_DRIVE_PDF_FOLDER_ID=<FOLDER_ID from the Drive URL>
   - Notes:
     - Re-exporting the same resume ID overwrites the existing Drive file of the same name instead of
       creating a duplicate.
     - `POST /api/resumes/<id>/export` then returns `{ path: <Drive webViewLink> }` instead of a local
       file path.
     - Leave `PDF_EXPORT_TARGET` unset (or `local`) to keep saving PDFs under `RESUME_FOLDER_PATH\resumes`.

3. Run the dev server
   npm run dev
   - Open http://localhost:3000/ to view the dashboard.

4. Test generation & export
   - POST to `/api/resumes/generate` with JSON: { "jobDescription": "..." }
     - This calls the configured AI provider and saves a validated resume JSON under `resumes/<id>.json`.
   - POST to `/api/resumes/<id>/export` to render PDF and save `resumes/<id>.pdf`.

Folder structure (high level)
- lib/
  - ai/
    - types.ts            — AIProvider interface
    - openrouter.ts       — OpenRouterProvider implementation
    - index.ts            — factory that returns the configured provider
  - storage/
    - types.ts            — ResumeStorage interface, ResumeMeta
    - local.ts            — LocalFolderStorage implementation (reads RESUME_FOLDER_PATH)
    - index.ts            — factory that returns the configured storage
  - resume/
    - schema.ts           — zod ResumeSchema (DO NOT CHANGE field names)
    - ResumeDocument.tsx  — PDF template used for export
- app/                    — Next.js App Router pages and API routes

Storage provider
- Interface: [lib/storage/types.ts](C:/Users/84983/Desktop/Resume_Generator/lib/storage/types.ts)
- Current implementation: [lib/storage/local.ts](C:/Users/84983/Desktop/Resume_Generator/lib/storage/local.ts)
  - Uses `fs/promises` and `js-yaml`.
  - Expects to find `resume_master_bank.yaml` and a `resumes/` directory under `RESUME_FOLDER_PATH`.
  - All errors from storage methods are wrapped with clear messages to help debugging.

AI provider
- Interface: [lib/ai/types.ts](C:/Users/84983/Desktop/Resume_Generator/lib/ai/types.ts)
- Current implementation: [lib/ai/openrouter.ts](C:/Users/84983/Desktop/Resume_Generator/lib/ai/openrouter.ts)
  - Calls the OpenRouter REST API via `fetch` and validates the provider output with the zod schema before returning.
  - The implementation expects to run server-side only (do not expose API keys to the client).

API routes and pages
- Dashboard: `GET /` (app/page.tsx) — lists resumes returned from storage.listResumes().
- Generate: `POST /api/resumes/generate` — body: { jobDescription } → calls AI provider, validates, saves, and returns id.
- Editor: `GET /resume/<id>` (app/resume/[id]/page.tsx) — basic textarea editor + save/export forms. Intended to be replaced with a client-side CodeMirror editor.
- Save: `POST /api/resumes/<id>/save` — accepts JSON or form content, validates with zod, and saves.
- Export: `POST /api/resumes/<id>/export` — renders PDF with `@react-pdf/renderer` and saves via storage.savePdf.

Extending the app
- To add another storage provider: implement the `ResumeStorage` interface from [lib/storage/types.ts](C:/Users/84983/Desktop/Resume_Generator/lib/storage/types.ts), add a factory case in [lib/storage/index.ts](C:/Users/84983/Desktop/Resume_Generator/lib/storage/index.ts), and set `STORAGE_PROVIDER` accordingly.
- To add another AI provider: implement the `AIProvider` interface from [lib/ai/types.ts](C:/Users/84983/Desktop/Resume_Generator/lib/ai/types.ts), add a factory case in [lib/ai/index.ts](C:/Users/84983/Desktop/Resume_Generator/lib/ai/index.ts), and set `AI_PROVIDER` accordingly.

Notes & caveats
- The Resume schema is authoritative: do not change field names in [lib/resume/schema.ts](C:/Users/84983/Desktop/Resume_Generator/lib/resume/schema.ts) — the PDF template depends on it.
- Do not import `fs`, `js-yaml`, or any AI SDK from pages, components, or routes other than the implementation files (`lib/storage/local.ts` and `lib/ai/openrouter.ts`). This keeps providers pluggable and prevents accidental leakage of server-only secrets to the client.
- The OpenRouter model name is configurable via the `OPENROUTER_MODEL` env var; adapt `lib/ai/openrouter.ts` if a different request shape is required for other models.
- Consider mocking the AI provider during development to avoid metered API calls and unexpected charges.

Contact / Maintainer
- This repo was scaffolded by an AI assistant using the Copilot CLI runtime in VS Code. For next steps (install deps, replace the textarea with CodeMirror, add tests), run the commands described above or open an issue describing what you'd like automated next.
