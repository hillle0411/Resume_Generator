# Resume Generator — Technical Spec

## 1. Purpose

A Next.js app that takes a job description, generates a tailored resume from a
personal "master data bank" using an LLM, lets the user lightly edit the result,
and exports it as a PDF. Storage and AI provider are both pluggable — the app
supports local disk, Google Drive, and Supabase interchangeably per data type,
selected entirely via environment variables (no code changes needed to switch).

Current deployment target: Vercel (serverless). All persistent state must
therefore live in an external service, not on disk — see §4.

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
app/api/auth/google/{start,callback} One-time OAuth flow (Drive PDF export only)

lib/ai/{types,openrouter,index}.ts       AIProvider interface + OpenRouter impl
lib/resume/{schema,ResumeDocument}.tsx   Data model + PDF template
lib/storage/{types,local,index}.ts       ResumeStorage interface + impl
lib/storage/{googleDrive,googleOAuth}.ts Google Drive read/write helpers
lib/storage/supabase.ts                  Supabase Storage read/write helpers
```

Both provider interfaces are intentionally narrow:

```ts
interface AIProvider {
  generateResume(jobDescription: string, masterBank: Record<string, unknown>): Promise<Resume>;
}

interface ResumeStorage {
  getMasterDataBank(): Promise<Record<string, unknown>>;
  saveMasterDataBank(data: Record<string, unknown>): Promise<void>; // local only, currently unused by any route
  listResumes(): Promise<ResumeMeta[]>;
  getResume(id: string): Promise<Resume>;
  saveResume(id: string, data: Resume): Promise<void>;
  savePdf(id: string, pdfBuffer: Buffer): Promise<string>; // returns a path or URL
}
```

`LocalFolderStorage` (`lib/storage/local.ts`) is the sole `ResumeStorage`
implementation, but **each of its four data concerns — master bank, resume JSON,
PDF, none of which are coupled to each other — independently reads an env var to
decide where it actually reads/writes**, rather than there being one global
"storage provider" switch. This lets you mix and match, e.g. master bank on
Supabase while PDFs go to Drive.

| Concern | Env var | Values | Backing code |
|---|---|---|---|
| Master data bank | `MASTER_BANK_SOURCE` | `local` (default) / `drive` / `supabase` | `googleDrive.ts` / `supabase.ts` |
| Resume JSON | `RESUME_STORAGE_TARGET` | `local` (default) / `supabase` | `supabase.ts` |
| PDF export | `PDF_EXPORT_TARGET` | `local` (default) / `drive` / `supabase` | `googleOAuth.ts`+`googleDrive.ts` / `supabase.ts` |

`AI_PROVIDER` similarly selects the AI implementation via `lib/ai/index.ts`
(currently only `openrouter` exists).

## 4. Why three different backends for one app

- **Local disk** — zero setup, but doesn't survive Vercel's ephemeral serverless
  filesystem. Fine for local dev only.
- **Google Drive** — chosen originally because the user already kept the master
  bank file there. Two auth modes ended up necessary:
  - **Service account** (`googleDrive.ts`, scope `drive.readonly`) — used for
    *reading* the master bank file. Works with zero user interaction once the
    file is shared with the service account's email.
  - **OAuth as the real user** (`googleOAuth.ts`, scope `drive.file`) — required
    for *writing* PDFs, because **service accounts have no storage quota of
    their own** and Drive rejects any file-create attempt from one
    (`storageQuotaExceeded`), even in a folder shared with them as Editor. This
    was discovered empirically after the service-account approach failed in
    production.
- **Supabase Storage** — added once the user confirmed they already had an
  account. Much lower setup cost than Drive OAuth (no consent screen, no
  refresh-token dance) — just a project URL + service role key. This became the
  default recommendation for Vercel deployment specifically because Drive OAuth
  requires either re-registering a redirect URI per domain or generating the
  refresh token locally and copying it over, whereas Supabase env vars are
  portable as-is.

## 5. AI provider (`lib/ai/openrouter.ts`)

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

## 6. PDF template (`lib/resume/ResumeDocument.tsx`)

Built with `@react-pdf/renderer`. Redesigned (see commit `80e82f8`) to match a
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

## 7. Deployment (Vercel)

Vercel's serverless functions have no persistent, writable filesystem, so
**all three storage concerns must point at Drive or Supabase, never `local`,
before deploying** — `RESUME_FOLDER_PATH` and `STORAGE_PROVIDER` can be omitted
entirely once they do.

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
   build time**, meaning a build would call out to Supabase/Drive during the
   build step itself, and any hiccup there would fail the whole deployment
   rather than just a page request. Fixed with `export const dynamic =
   "force-dynamic"` on both `app/page.tsx` and `app/resume/[id]/page.tsx`
   (`ff5a0e7`).

Full setup steps (Google Cloud service account + OAuth client creation,
Supabase bucket setup, exact env var names) are in `README.md`, which is the
operational source of truth — this spec covers *why* the architecture looks
this way, not the click-by-click setup.

## 8. Known limitations / open items

- `saveMasterDataBank` is only implemented for local storage — no route
  currently calls it anyway, so editing the master bank means editing the file
  directly wherever it lives.
- Skills are a flat list; no category grouping in the schema or PDF template.
- The dashboard and editor pages are intentionally bare HTML forms (no
  client-side JS, no CodeMirror despite the dependency being installed) —
  functional prototype, not a polished UI.
- `/api/auth/google/*` (the one-time Drive OAuth flow) has no auth guard of its
  own, consistent with the rest of the app having none. Fine for personal use;
  would need locking down before wider exposure.
- No tests exist.
