# Phase 5 — Deploy (RunPod Serverless + Vercel)

**Status:** COMPLETE
**Date:** 2026-03-11 → 2026-03-19

---

## What Was Done

### Docker Image
- Built image: `ghcr.io/mcusta/corridorkey-worker:v1` (7.32 GB)
- Pushed to GitHub Container Registry (public)
- Packages: CorridorKey engine, model weights, RunPod serverless handler, all Python deps

### Dockerfile Bug Fixes
1. **Missing source directories** — Added COPY for `gvm_core/`, `VideoMaMaInferenceModule/`, `corridorkey_cli.py`
2. **PyTorch version conflict** — Used `--no-deps` for editable install to avoid CPU-only torch
3. **`.dockerignore` in wrong location** — Moved from `worker/.dockerignore` to repo root

### RunPod Serverless Endpoint
- Endpoint ID: `z5gdtxbajlj27b`
- GPU: RTX 4090 (24GB tier) — 5090/Blackwell NOT compatible with PyTorch 2.6
- Max Workers: 1, Active Workers: 0, Execution Timeout: 1800s, Idle Timeout: 600s
- Environment variables set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Web App (Vercel)
- Live at: **https://fxlab.vercel.app**
- Custom domain: `fxlab.vercel.app` (aliased from auto-generated Vercel URL)
- App renamed to **AI FX Lab** (branding in navbar, login, page title)
- All environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RUNPOD_ENDPOINT_ID`, `RUNPOD_API_KEY`
  - `CRON_SECRET` (for cleanup cron auth)

### Storage Management (added late Phase 5)
- **Auto-cleanup**: Daily cron at 3 AM UTC deletes completed/failed jobs older than 24h
  - API route: `POST /api/cleanup` (protected by CRON_SECRET)
  - Vercel cron config: `web/vercel.json`
- **Storage indicator**: Navbar shows usage bar (green/amber/red) + size display
  - API route: `GET /api/storage/usage`
- **Supabase Site URL**: Updated to `https://fxlab.vercel.app` for magic links

### Code Changes (Phase 5)
- `worker/handler.py` — RunPod serverless handler
- `worker/Dockerfile` — Docker image for RunPod
- `web/src/app/api/jobs/[id]/trigger/route.ts` — RunPod trigger API
- `web/src/app/api/cleanup/route.ts` — Auto-cleanup cron endpoint
- `web/src/app/api/storage/usage/route.ts` — Storage usage API
- `web/src/components/Navbar.tsx` — Renamed to AI FX Lab + storage indicator
- `web/src/app/layout.tsx` — Page title: AI FX Lab
- `web/src/app/login/page.tsx` — Login heading: AI FX Lab
- `web/vercel.json` — Cron schedule
- `.dockerignore` — Moved to repo root

---

## End-to-End Test Results

### 4K Test: Shot01-Close (100 frames, 4K resolution)
- **GPU**: RTX 4090 (24GB)
- **Processing time**: ~10-13 min
- **Cold start**: ~2-5 min (image pull + model load)
- **Warm start**: <1 sec
- **Result**: COMPLETED — all output files generated and downloadable

### Issues Found & Resolved
1. **5090 incompatibility**: RTX 5090 (Blackwell) fails with "no kernel image" CUDA error. Fixed by selecting 24GB tier only (RTX 4090).
2. **Missing env vars**: RunPod endpoint initially missing `SUPABASE_URL` — added to endpoint config.
3. **Execution timeout**: Default 600s too short for 4K. Increased to 1800s.
4. **Supabase storage limit**: Free tier is 1GB. Added auto-cleanup to stay within limit.

---

## Architecture

```
Browser → Vercel (Next.js) → RunPod Serverless (GPU) → Supabase (DB + Storage)
```

1. User submits job → web app saves to Supabase (status: queued)
2. Web app calls RunPod `/run` with job_id
3. RunPod spins up GPU worker → handler claims job → processes → uploads results
4. Web app polls Supabase and shows progress in real-time
5. GPU worker shuts down after idle timeout (600s)
6. Daily cron cleans up jobs older than 24h
