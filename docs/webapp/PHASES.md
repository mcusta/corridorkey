# AI FX Lab — Phase Tracker

## Overview

Building a private internal MVP multi-tool hub for AI film/VFX processing.
Each phase is designed to be done in a separate chat session with clean context.

---

## Phase 1 — Build All Code
**Status: COMPLETE**

Write all code for the web app, worker, and database schema.

- [x] Supabase schema SQL (`supabase/schema.sql`)
- [x] Scaffold Next.js app with Tailwind dark theme
- [x] Supabase client helpers (anon + service_role)
- [x] TypeScript types + constants
- [x] Auth middleware + login page
- [x] Job creation API routes (`POST`, `PATCH`, `GET`)
- [x] Signed upload URL route (`POST /api/upload`)
- [x] Job detail + files API routes
- [x] FileUploader component (drag-drop + signed URL upload)
- [x] NewJobForm component (2-step: config → upload)
- [x] Jobs list page + JobCard + StatusBadge
- [x] Job detail page + OutputPreview + DownloadButton
- [x] GPU worker: `worker.py`, `job_processor.py`, `supabase_client.py`, `frame_utils.py`
- [x] ARCHITECTURE.md + .env.example files + worker README
- [x] Next.js build passes clean

**Report:** `docs/webapp/PHASE1_REPORT.md`

---

## Phase 2 — Connect Supabase + Test Web App
**Status: COMPLETE**

Connect to real Supabase project and test the web app locally.

- [x] Run `supabase/schema.sql` in Supabase SQL Editor
- [x] Create `job-assets` private storage bucket
- [x] Set storage policies (authenticated upload, service_role bypass)
- [x] Create user account in Supabase Auth dashboard
- [x] Fill in `web/.env.local` with real keys
- [x] Run `npm run dev` and test login
- [x] Test job creation flow (draft → upload → queued)
- [x] Verify job appears in jobs list
- [x] Verify signed upload URLs work
- [x] Fix any issues found

**Report:** `docs/webapp/PHASE2_REPORT.md`

---

## Phase 3 — GPU Worker Test
**Status: COMPLETE**

Deploy worker to a GPU machine and test end-to-end processing.

- [x] Set up Runpod (A4090) with 24GB+ VRAM
- [x] Clone repo, install deps, download CorridorKey model weights
- [x] Configure `worker/.env` with Supabase keys
- [x] Run `python worker.py`
- [x] Submit a real job through web UI
- [x] Verify: queued → preparing → processing → uploading → completed
- [x] Verify output files appear in Supabase Storage
- [x] Verify comp PNG preview works in web UI
- [x] Verify download buttons appear

**Report:** `docs/webapp/PHASE3_REPORT.md`

---

## Phase 4 — Fix + Polish
**Status: COMPLETE**

Fix whatever breaks in Phase 2-3 and polish the experience.

- [x] UI navigation: navbar links, back buttons, rename/delete jobs
- [x] Preview & playback: gallery, lightbox, 24fps playback, keyboard nav
- [x] Downloads: ZIP per type, Download All, progress indicators
- [x] File naming: `{JobName}_{type}_{frame}.{ext}`
- [x] Bug fixes: batch signed URLs, cursor-pointer, status badges
- [x] Upload phase preview: live comp preview during upload
- [x] Estimated cost display on completed and in-progress jobs

**Report:** `docs/webapp/PHASE4_REPORT.md`

---

## Phase 5 — Deploy (RunPod Serverless + Vercel)
**Status: COMPLETE**

Migrate from always-on GPU pod to pay-per-second serverless. Deploy web app to Vercel.

### RunPod Serverless Worker
- [x] Create `worker/handler.py` — RunPod serverless handler
- [x] Create `worker/Dockerfile` — packages worker + CorridorKey + model weights
- [x] Fix Dockerfile: missing source dirs, PyTorch version, .dockerignore location
- [x] Build & push Docker image to GHCR (`ghcr.io/mcusta/corridorkey-worker:v1`, 7.32 GB)
- [x] Create RunPod Serverless Endpoint (endpoint: `z5gdtxbajlj27b`)
- [x] Configure env vars on RunPod (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [x] Set execution timeout to 1800s (required for 4K jobs)

### Web App Integration
- [x] Add `POST /api/jobs/[id]/trigger` — calls RunPod `/run` endpoint
- [x] Update job creation flow — auto-trigger after status becomes `queued`
- [x] Add `RUNPOD_ENDPOINT_ID` and `RUNPOD_API_KEY` env vars

### Web App Deployment
- [x] Deploy web app to Vercel
- [x] Set Vercel env vars (Supabase + RunPod + CRON_SECRET)
- [x] Custom domain: https://fxlab.vercel.app
- [x] Rename app branding to "AI FX Lab" (navbar, login, page title)

### Storage Management
- [x] Auto-cleanup cron: daily at 3 AM UTC, deletes jobs >24h old
- [x] Storage usage indicator in navbar (green/amber/red bar + size)
- [x] Update Supabase Site URL to https://fxlab.vercel.app

### End-to-End Verification
- [x] Submit job through deployed web app
- [x] Verify: queued → preparing → processing → uploading → completed
- [x] Verify preview + download works
- [x] Test cold start time (~2-5 min)
- [x] Test 4K video (100 frames, ~10-13 min on RTX 4090)

**Report:** `docs/webapp/PHASE5_REPORT.md`

---

## Phase 6 — Hub Architecture + MatAnyone2
**Status: READY TO BUILD**

Transform the single-tool app into a multi-tool AI FX hub. Add MatAnyone2 as the second tool.

### Hub Architecture
- [ ] Create home page with tool selector cards (CorridorKey, MatAnyone2)
- [ ] Move CorridorKey new job form to `/tools/corridorkey/new`
- [ ] Add `engine` column to `jobs` table ("corridorkey" | "matanyone2")
- [ ] Update job creation API to accept engine type
- [ ] Shared job detail page works for both engines (`/jobs/[id]`)

### MatAnyone2 — Web UI
- [ ] Create `/tools/matanyone/new` page
- [ ] Video upload + first frame extraction
- [ ] Interactive mask selector: browser-side MobileSAM (ONNX Runtime)
- [ ] Click on person → SAM generates mask → show overlay
- [ ] Positive/negative point clicks, mask refinement
- [ ] Confirm mask → upload mask PNG + video → submit job

### MatAnyone2 — Worker
- [ ] Add MatAnyone2 to Dockerfile (`pip install matanyone2` or clone + install)
- [ ] Create `matanyone2_processor.py` in worker
- [ ] Update `handler.py` to route by engine type
- [ ] MatAnyone2 output: alpha matte video (`_pha.mp4`) + foreground video (`_fgr.mp4`)
- [ ] Adapt upload flow for video outputs (not frame sequences)

### Docker & Deploy
- [ ] Rebuild Docker image with MatAnyone2 (v2)
- [ ] Push to GHCR
- [ ] Deploy updated web app to Vercel
- [ ] End-to-end test: MatAnyone2 job through full pipeline

**Guide:** `docs/webapp/PHASE6_GUIDE.md`

---

## Key Files Reference

| Component | Key Files |
|-----------|-----------|
| DB Schema | `supabase/schema.sql` |
| Web App | `web/src/` (Next.js App Router) |
| API Routes | `web/src/app/api/` |
| Worker (serverless) | `worker/handler.py`, `worker/Dockerfile` |
| Worker (processing) | `worker/job_processor.py`, `worker/supabase_client.py` |
| Architecture | `docs/webapp/ARCHITECTURE.md` |
| Plan | `docs/webapp/PLAN.md` |
| Phase Reports | `docs/webapp/PHASE{N}_REPORT.md` |
| Phase Guides | `docs/webapp/PHASE{N}_GUIDE.md` |
