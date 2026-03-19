# Phase 4 — Fix + Polish (In Progress)

**Status:** IN PROGRESS
**Date:** 2026-03-09

---

## What Was Done

### UI Navigation & Actions
- Added "Jobs" link to navbar with active state highlighting
- Added "Back to Jobs" with chevron arrow on job detail and new job pages
- Rename job: inline text edit on both jobs list (three-dot menu) and detail page (pencil icon)
- Delete job: confirmation dialog, deletes all storage files (inputs + outputs) and DB rows
- API: `PATCH /api/jobs/[id]` (rename), `DELETE /api/jobs/[id]` (delete with storage cleanup)
- Blocks deletion of actively-processing jobs

### Preview & Playback
- Gallery hidden by default — "View Frames" button toggles it open/closed
- All comp images preload silently in background on page load
- Loading counter on buttons: `View Frames 42/147`, `Loading 42/147`
- Play button disabled until all frames cached — ensures smooth playback
- Fullscreen lightbox: prev/next arrows, close X button, click-outside to close
- Play/pause at 24fps with loop (Space key toggles)
- Scrub slider to jump to any frame
- Frame counter: `42 / 147`
- Arrow keys to step frame-by-frame (auto-pauses playback)
- Escape to close lightbox

### Downloads
- File type buttons (MATTE, FG, PROCESSED, COMP) visible immediately — no expand step
- Each type downloads as ZIP via jszip (`{jobName}_{type}.zip`)
- "Download All" button: single ZIP with subfolders per type (`{jobName}/matte/`, `{jobName}/fg/`, etc.)
- Zipping state shown on buttons while building archive
- Download icon on each type button

### File Naming
- Output files now named `{JobName}_{type}_{frame}.{ext}`
- Example: `Shot02-Close_comp_00000.png`, `Shot02-Close_fg_00000.exr`
- Job name sanitized for filenames (spaces/special chars → underscores)
- Change is in worker `job_processor.py` — only affects new jobs

### Bug Fixes
- **Signed URL generation**: Changed from 592 individual `createSignedUrl()` calls to batched `createSignedUrls()` in chunks of 100. Was causing many silent failures resulting in wrong file counts (e.g. 104 instead of 148).
- **Cursor pointer**: Global CSS rule `button { cursor: pointer !important }` to override Tailwind v4 reset. Also added explicit `cursor-pointer` class on sign-out, rename, delete buttons.
- **Pulsing status dot**: Active statuses (queued/preparing/processing/uploading) show animated ping dot
- **Processing duration**: Shows formatted duration on completed jobs (e.g. "12m 34s")
- **Frame count**: Shows total frames on completed jobs in both list and detail views
- **Status messages**: "Waiting for GPU worker..." (queued), "Worker is preparing..." (preparing)
- **Empty state**: Better jobs list empty state with "Create your first job" button

### Dependencies Added
- `jszip` (^3.10.1) — client-side ZIP file generation

---

## Files Changed

### Web App
- `web/src/app/globals.css` — cursor-pointer global rule
- `web/src/components/Navbar.tsx` — Jobs link, cursor fix
- `web/src/components/JobCard.tsx` — three-dot menu, rename/delete, frame count
- `web/src/components/StatusBadge.tsx` — pulsing dot for active statuses
- `web/src/components/OutputPreview.tsx` — toggleable gallery, preload, lightbox, playback
- `web/src/components/DownloadButton.tsx` — ZIP downloads, Download All, auto-load
- `web/src/app/jobs/page.tsx` — onUpdated callback, empty state
- `web/src/app/jobs/[id]/page.tsx` — back nav, rename/delete, duration, frame count
- `web/src/app/jobs/new/page.tsx` — back nav
- `web/src/app/api/jobs/[id]/route.ts` — PATCH (rename) + DELETE endpoints
- `web/src/app/api/jobs/[id]/files/route.ts` — batch signed URL generation

### Worker
- `worker/job_processor.py` — `_sanitize_name()`, display name format `{name}_{type}_{frame}.{ext}`

---

### Upload Phase Preview
- OutputPreview now accepts `isUploading` prop — polls files API every 3s during uploading status
- Comp frames appear in gallery as they're uploaded (comp is the first type worker uploads)
- Incremental image preloading: uses a Set to track preloaded URLs, handles new files from polling
- New UploadProgress component: shows per-type progress (COMP/FG/MATTE/PROCESSED) with overall progress bar
- UploadProgress replaces the frame processing progress bar during uploading status
- Smooth transition: when status changes to "completed", UploadProgress unmounts, DownloadButton appears

### Estimated Cost
- Shows GPU cost in job header metadata
- Completed jobs: actual cost from processing duration × $0.69/hr (Runpod A4090 rate)
- In-progress/queued jobs: estimated from total_frames × ~1.2s/frame × hourly rate
- Constants in `web/src/lib/constants.ts`: `GPU_HOURLY_RATE`, `SECONDS_PER_FRAME_ESTIMATE`

### Files Added
- `web/src/components/UploadProgress.tsx` — upload progress with per-type breakdown

### Files Changed (this session)
- `web/src/lib/constants.ts` — GPU cost constants
- `web/src/components/OutputPreview.tsx` — `isUploading` prop, polling, incremental preload
- `web/src/app/jobs/[id]/page.tsx` — upload preview, UploadProgress, cost estimate

## Still TODO
- Test error handling (kill worker mid-job, verify stale recovery)
- Test with 4K video
