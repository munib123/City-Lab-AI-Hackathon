# Deploying MedLens

The backend is one FastAPI app (`backend/medlens/api.py`). It needs no database: the knowledge base, parsed corpus,
unit factors and explanations are JSON files in `data/`, shipped with the code. The frontend is a separate project
that calls this API (CORS is open by default).

| Where | How |
|---|---|
| **Vercel** (live link) | root `index.py` + `vercel.json` (`framework: fastapi`, region `bom1`). Deps come from `pyproject.toml` |
| **Docker** (README fallback) | `Dockerfile` + `docker-compose.yml` |

## Two Vercel projects, one repo

Both projects are connected to `munib123/City-Lab-AI-Hackathon` (production branch `main`), so every merge to `main` deploys
both automatically, and every PR branch gets a preview of each.

| Project | Root directory | What it serves | Address |
|---|---|---|---|
| `bahria_isl_ai` | `frontend` | the UI (TanStack Start / Lovable app) | https://bahriaislai.vercel.app (the link to share) |
| `medlens-api` | `/` (repo root) | the FastAPI backend | https://medlens-api-delta.vercel.app |

Why two: one is a Node app and the other is Python, and Vercel builds one framework per project.

**The frontend must be built with `NITRO_PRESET=vercel`.** The Lovable setup builds for Cloudflare by default, and that output
cannot be served by Vercel (the deployment looks empty). `frontend/vercel.json` sets the preset and pins `npm ci`, because the
folder has both `bun.lock` and `package-lock.json`.

Environment variables are per project. The API project holds `GEMINI_API_KEY`, `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (the frontend does not need them). After the frontend calls the API, set `PUBLIC_APP_URL` on the
API project to `https://bahriaislai.vercel.app` so QR codes open the frontend (its report page must accept ids like `P004`).

On Vercel's free (Hobby) plan, a Git deployment can be blocked when the commit author is not on the Vercel team. Merging through a
pull request from the team owner's account avoids that; direct pushes to `main` from other accounts may not deploy.

## Environment variables

| Name | Needed | What |
|---|---|---|
| `GEMINI_API_KEY` | for chat only | without it the whole app still works; chat answers "unavailable" (the privacy and no-diagnosis refusals still work) |
| `GEMINI_MODEL` | no | default `gemini-2.5-flash` |
| `GEMINI_FALLBACK_MODEL` | no | default `gemini-2.5-flash-lite`, tried once if the main model is busy, rate-limited or slow. Empty = off |
| `LLM_PROVIDER` | no | `gemini` (default) or `groq` (then `GROQ_API_KEY`, `GROQ_MODEL`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | for storage | added automatically by the Vercel Supabase integration. Without them nothing is stored and everything else works. `SUPABASE_SECRET_KEY` is used if the service-role key is missing |
| `PUBLIC_APP_URL` | no | the frontend's public address, e.g. `https://my-frontend.vercel.app`. QR codes open `<PUBLIC_APP_URL>/reports/<id>`. Unset = QR opens the API's own report page |
| `TTS_VOICE` | no | default read-aloud voice, one of the list in `docs/API.md`. Default `en-US-AriaNeural` |
| `CORS_ORIGINS` | no | comma-separated list of allowed frontend origins; default `*` |

Keys are never committed. A test scans the repo for key-shaped strings.

Run `python scripts/check_llm.py` to confirm a key works and to see which models it can use.

## Vercel

The project is linked with `vercel link`. To deploy a preview of what is committed:

```
vercel deploy          # preview (protected by Vercel Authentication on a new project)
vercel deploy --prod   # production
```

Set the key as a secret, **from a file or a prompt, not by piping a PowerShell string**:

```
vercel env add GEMINI_API_KEY production --sensitive
vercel env add GEMINI_API_KEY preview --sensitive
```

> **Windows gotcha:** `"key" | vercel env add ...` in Windows PowerShell 5.1 puts an invisible byte-order mark in front of
> the value. The secret then contains a hidden character and every Gemini call fails. Use the interactive prompt, or
> `cmd /c "type keyfile | vercel env add ..."` with a file saved as plain ASCII. The app now strips such characters
> from keys and degrades to "chat unavailable" instead of failing, but a clean secret is still the right fix.

Preview URLs are behind Vercel Authentication. To call one from a script, use `vercel curl <url>/api/health`.
For a public link, deploy to production (or turn off protection for the project in Settings, Deployment Protection).

Check a deployment:

```
vercel curl https://<deployment>/api/health        # "llm_enabled": true when the key is set
vercel logs --deployment <deployment>              # function errors show here
```

Why these settings:
- `framework: "fastapi"` is needed; without a preset Vercel only looks for functions in `api/` and the build fails.
- Dependencies must be in `pyproject.toml`. When it exists Vercel installs from it and ignores `requirements.txt`
  (the first deploy crashed with "No module named fastapi"). A test keeps both lists in sync.
- `regions: ["bom1"]` keeps the function next to the Supabase database in Mumbai, should one be added later.

## Docker

```
docker compose up --build        # API on http://localhost:8000 (docs at /docs)
```

Keys come from your shell or a `.env` file next to `docker-compose.yml` (for example `GEMINI_API_KEY=...`). They are never
copied into the image. The compose health check calls `/api/health`.

## Connecting the frontend

Point the frontend's API base URL at the deployed API origin. Set `CORS_ORIGINS` to the frontend's origin if you want to
lock it down. The response shapes are in `docs/API.md`.
