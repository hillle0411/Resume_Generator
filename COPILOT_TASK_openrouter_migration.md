# Task: Replace Anthropic API with OpenRouter

## Why
We're switching the AI provider from calling Anthropic's API directly to calling
[OpenRouter](https://openrouter.ai) instead, using an OpenRouter API key. OpenRouter
exposes an OpenAI-compatible REST API (`POST https://openrouter.ai/api/v1/chat/completions`),
so we no longer need the `@anthropic-ai/sdk` package — plain `fetch` is enough.

## Scope
Only touch the AI provider layer. Do not change:
- `lib/resume/schema.ts` (Resume schema field names)
- `lib/storage/*`
- Any API route signatures (`app/api/resumes/generate/route.ts` should keep working unchanged)

## Changes required

### 1. `package.json`
- Remove the dependency `"@anthropic-ai/sdk": "^0.1.0"`.
- No new dependency is required (use built-in `fetch`, available in Node 18+ and Next.js 13).

### 2. Rename/rewrite `lib/ai/claude.ts` → `lib/ai/openrouter.ts`
Delete `lib/ai/claude.ts` and create `lib/ai/openrouter.ts` with an `OpenRouterProvider`
class that implements the existing `AIProvider` interface from `lib/ai/types.ts`.

Requirements for the new provider:
- Read the API key from `process.env.OPENROUTER_API_KEY`. Throw a clear error in the
  constructor if it's not set (same pattern as the old `ANTHROPIC_API_KEY` check).
- Call OpenRouter's chat completions endpoint with `fetch`:
  - URL: `https://openrouter.ai/api/v1/chat/completions`
  - Method: `POST`
  - Headers:
    - `Authorization: Bearer ${apiKey}`
    - `Content-Type: application/json`
    - (optional but recommended by OpenRouter) `HTTP-Referer` and `X-Title` headers —
      can be omitted for now.
  - Body (JSON):
    ```json
    {
      "model": "openai/gpt-4o-mini",
      "messages": [
        { "role": "system", "content": "<same system prompt as before>" },
        { "role": "user", "content": "<same user prompt as before>" }
      ],
      "max_tokens": 1500
    }
    ```
  - Pick a sensible default model string and make it overridable via an
    `OPENROUTER_MODEL` env var (fallback to `"openai/gpt-4o-mini"` if unset).
- Keep the exact same prompt content/wording currently in `lib/ai/claude.ts`
  (the system prompt instructing "return ONLY valid JSON..." and the user prompt
  combining `masterBank` + `jobDescription`).
- Parse the response as `response.choices[0].message.content`, trim it, `JSON.parse` it,
  and validate with `ResumeSchema.parse(...)` exactly like the old code did.
- Wrap any failure (network error, non-OK HTTP status, JSON parse failure, schema
  validation failure) in a thrown `Error` with a message prefixed
  `"OpenRouterProvider failed to generate a valid resume: "`, mirroring the old
  `ClaudeProvider` error handling.
- Check `response.ok` after the fetch call and throw with the response status/text if
  the request failed, before trying to parse JSON.

### 3. `lib/ai/index.ts`
- Change the import from `ClaudeProvider` (`./claude`) to `OpenRouterProvider` (`./openrouter`).
- Change the default value of `AI_PROVIDER` from `"claude"` to `"openrouter"`.
- Update the `if` branch to check for `"openrouter"` and return `new OpenRouterProvider()`.

### 4. `.env.local` (local file, not committed — update manually, no code change needed)
Replace:
```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```
with:
```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

### 5. `README.md`
- In "Environment variables" example block: replace `AI_PROVIDER=claude` /
  `ANTHROPIC_API_KEY=sk-ant-...` with `AI_PROVIDER=openrouter` /
  `OPENROUTER_API_KEY=sk-or-...` (and optionally `OPENROUTER_MODEL=...`).
- In "Folder structure": rename `claude.ts — ClaudeProvider implementation` to
  `openrouter.ts — OpenRouterProvider implementation`.
- In "AI provider" section: replace the description of using `@anthropic-ai/sdk` with
  a description of calling the OpenRouter REST API via `fetch`, and update the file
  link from `lib/ai/claude.ts` to `lib/ai/openrouter.ts`.
- In "Notes & caveats": update the reference to `lib/ai/claude.ts` to
  `lib/ai/openrouter.ts`, and update the note about "the Claude SDK call ... assumes a
  generic completion method" to instead note the OpenRouter model name is configurable
  via `OPENROUTER_MODEL`.

## Acceptance criteria
- `npm run type-check` passes.
- No remaining references to `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, `ClaudeProvider`,
  or `lib/ai/claude.ts` anywhere in the repo (code, README, package.json).
- `getAIProvider()` returns a working `OpenRouterProvider` by default.
- `POST /api/resumes/generate` still works end-to-end against the new provider (manual
  test with a real `OPENROUTER_API_KEY` in `.env.local`).
