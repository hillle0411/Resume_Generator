# Resume Generator — Technical Spec

## 1. Purpose

A Next.js app that takes a job description, generates a tailored resume from a
personal "master data bank" using an LLM, lets the user lightly edit the result,
and exports it as a PDF.

**Production stack:** hosted on **Vercel**, all persistent state (master data
bank, generated resume JSON, exported PDFs) lives in **Supabase Storage**,
generation is via **OpenRouter**. Vercel's serverless functions have no
persistent, writable filesystem, so nothing in production touches local disk.

## 2. Data model

`lib/resume/schema.ts` defines the authoritative `ResumeSchema` (zod). **Field
names must not change** — `lib/resume/ResumeDocument.tsx` (the PDF template)
depends on them directly.

```ts
Resume = {
  name: string
  targetRole?: string
  contact: { location?: string; email?: string; linkedin?: string }
  summary?: string
  experience: { title: string; company: string; dates: string; bullets: string[] }[]
  education: { degree: string; institution: string; dates: string }[]
  skills: string[]
}
```

The "master data bank" is a YAML file (`resume_master_bank.yaml`) containing the
user's full career history/skills — an unstructured superset of everything that
might go into a resume. The AI provider is given this plus a job description and
asked to produce a `Resume` tailored to that job.

## 3. Architecture

```
app/page.tsx                         Dashboard: list resumes, job-description form
app/resume/[id]/page.tsx             Editor: raw JSON textarea, Save / Export PDF
app/api/resumes/generate/route.ts    POST → AI provider → validate → save
app/api/resumes/[id]/save/route.ts   POST → validate → save
app/api/resumes/[id]/export/route.tsx POST → render PDF → save

lib/ai/{types,openrouter,index}.ts       AIProvider interface + OpenRouter impl
lib/resume/{schema,ResumeDocument}.tsx   Data model + PDF template
lib/storage/{types,local,index}.ts       ResumeStorage interface + impl
lib/storage/supabase.ts                  Supabase Storage read/write helpers
```

Both provider interfaces are intentionally narrow:

```ts
interface AIProvider {
  generateResume(jobDescription: string, masterBank: Record<string, unknown>): Promise<Resume>;
}

interface ResumeStorage {
  getMasterDataBank(): Promise<Record<string, unknown>>;
  listResumes(): Promise<ResumeMeta[]>;
  getResume(id: string): Promise<Resume>;
  saveResume(id: string, data: Resume): Promise<void>;
  savePdf(id: string, pdfBuffer: Buffer): Promise<string>; // returns a public URL
}
```

`LocalFolderStorage` (`lib/storage/local.ts`) is the one `ResumeStorage`
implementation, but each of its data concerns (master bank / resume JSON / PDF)
independently checks an env var and delegates to Supabase in production:

| Concern | Env var (production value) |
|---|---|
| Master data bank | `MASTER_BANK_SOURCE=supabase` |
| Resume JSON | `RESUME_STORAGE_TARGET=supabase` |
| PDF export | `PDF_EXPORT_TARGET=supabase` |

`AI_PROVIDER=openrouter` selects the AI implementation via `lib/ai/index.ts`.

Exact bucket names, keys, and setup steps are in `README.md` — this spec
covers architecture and reasoning, not click-by-click configuration.

> The code also has unused Google Drive and local-disk implementations
> (`lib/storage/googleDrive.ts`, `googleOAuth.ts`, and the `local`/`drive`
> branches in `local.ts`) left over from earlier iteration before settling on
> Supabase. They're dead weight for the current deployment — don't reach for
> them, and they're a reasonable candidate to delete if this project doesn't
> plan to reintroduce Drive.

## 4. AI provider (`lib/ai/openrouter.ts`)

Calls OpenRouter's OpenAI-compatible chat completions endpoint directly via
`fetch` (no SDK). Configurable via:

- `OPENROUTER_API_KEY` (required)
- `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`) — free models like
  `google/gemma-4-31b-it:free` work but are less reliable (see below)
- `OPENROUTER_MAX_TOKENS` (default `4000`) — raised from an initial `1500`
  after truncation produced invalid JSON on resumes with multiple jobs
- `OPENROUTER_MAX_ATTEMPTS` (default `3`) — free/small models occasionally
  emit malformed JSON on an otherwise-fine request; retrying the whole call
  usually succeeds

The system prompt gives the model a **literal JSON template** (not just a
schema description) — small models were renaming keys and grouping `skills`
into a category object instead of a flat array until the prompt was made this
explicit. Response parsing (`extractJson`) also strips markdown code fences and,
failing that, falls back to slicing between the first `{` and last `}`, since
some models wrap the JSON in ```` ```json ```` fences regardless of instructions.

## 5. PDF template (`lib/resume/ResumeDocument.tsx`)

Built with `@react-pdf/renderer`. Redesigned (commit `80e82f8`) to match a
professional reference resume: centered header (name / contact line / target
role), bold uppercase section headings with an underline rule, italicized
company/dates per job, hanging-indent bullets, bulleted skills line. Uses only
fields already in `ResumeSchema` — the reference resume grouped skills into
labeled categories, which the current flat `skills: string[]` can't represent
without a schema change (not yet done).

Known Next.js/Vercel-specific gotcha: `@react-pdf/renderer` must be excluded
from webpack bundling (`next.config.js`
`experimental.serverComponentsExternalPackages`), or the API route throws
`TypeError: Cannot redefine property: BlobProvider` from double-initialization.
The export route file must also be `.tsx`, not `.ts`, since it contains JSX.

## 6. Deployment (Vercel)

Env vars needed in Vercel (Project Settings → Environment Variables):
`AI_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
`MASTER_BANK_SOURCE=supabase`, `RESUME_STORAGE_TARGET=supabase`,
`PDF_EXPORT_TARGET=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_MASTER_BANK_BUCKET`, `SUPABASE_MASTER_BANK_PATH`,
`SUPABASE_RESUMES_BUCKET`, `SUPABASE_PDF_BUCKET`. `RESUME_FOLDER_PATH` and
`STORAGE_PROVIDER` are not needed at all in production.

Two bugs specific to the Vercel build were found and fixed:

1. **`.gitignore` was silently excluding `lib/resume/` and `app/resume/`.** A
   defensive rule (`Resume/`, meant to exclude an external data folder that was
   never inside the repo to begin with) matched case-insensitively on Windows
   and also caught those source directories. Every commit since the project
   started omitted `schema.ts`, `ResumeDocument.tsx`, and the editor page —
   invisible locally (files still exist on disk) but fatal on a fresh clone
   (`Module not found`). Fixed in `2b0e166`; verify with `git ls-files` after
   any future `.gitignore` edit if imports mysteriously fail only in CI/deploy.
2. **Pages fetching live storage data were being statically prerendered at
   build time**, meaning a build would call out to Supabase during the build
   step itself, and any hiccup there would fail the whole deployment rather
   than just a page request. Fixed with `export const dynamic =
   "force-dynamic"` on both `app/page.tsx` and `app/resume/[id]/page.tsx`
   (`ff5a0e7`).

## 7. Known limitations / open items

- `saveMasterDataBank` on `ResumeStorage` is only implemented for local
  storage, and no route calls it — editing the master bank means editing the
  file directly in the Supabase bucket (download, edit, re-upload).
- Skills are a flat list; no category grouping in the schema or PDF template.
- The dashboard and editor pages are intentionally bare HTML forms (no
  client-side JS, no CodeMirror despite the dependency being installed) —
  functional prototype, not a polished UI.
- No tests exist.
