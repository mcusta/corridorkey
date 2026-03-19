# Phase 3 — GPU Worker Test

**Status:** COMPLETE
**Date:** 2026-03-09

---

## What Was Done

Deployed the GPU worker to a RunPod A4090 instance and ran the first real end-to-end job through the full pipeline.

### RunPod Setup

- **GPU:** NVIDIA A4090 (24GB VRAM)
- **Template:** RunPod PyTorch 2.x (pre-installed CUDA + Python)
- **Repo:** Cloned + pulled from fork
- **Dependencies:** `pip install -e .` (CorridorKey + torch/cv2/timm/numpy) + `pip install -r worker/requirements.txt` (supabase/dotenv)
- **Model weights:** Downloaded `CorridorKey_v1.0.pth` (~300MB) to `CorridorKeyModule/checkpoints/`

### Issues Encountered During Setup

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError: No module named 'dotenv'` | `pip install python-dotenv` (wasn't installed despite being in requirements.txt) |
| `ImportError: cannot import name 'create_client' from 'supabase'` | `pip install --force-reinstall supabase` (broken after `pip install -e .` dependency resolution) |
| `torchaudio 2.4.1 requires torch==2.4.1` warning | Harmless — torchaudio not used by worker |

### Job Processed

```
Job:    Shot02-Close
ID:     0ee44b7c-761d-4119-94c8-9e1fde1d8640
Frames: 148 (input) → 147 (comp preview)
Status: Completed
Created:   3/9/2026, 12:53 PM
Completed: 3/9/2026, 2:51 PM
```

### Performance

- **Processing:** ~150 frames in ~9 minutes → ~3.6s/frame at HD on A4090
- **Upload:** 4 output types × 148 files = 592 files uploaded to Supabase Storage
- **Total wall time:** ~2 hours (includes download, extraction, processing, uploading)

### What Worked

- Worker claimed queued job automatically on startup
- Full status progression visible in web UI: queued → preparing → processing → uploading → completed
- Frame-by-frame progress updates visible during processing phase
- All 4 output types generated and uploaded: FG (EXR), Matte (EXR), Comp (PNG), Processed (RGBA EXR)
- Comp PNG preview grid renders correctly in web UI (147 frames)
- Download buttons appear grouped by type (Matte, FG, Processed, Comp — 148 files each)
- Job settings displayed correctly (Despill 5/10, Refiner 1.0x, Despeckle On, Input sRGB)
- Worker polls and stays running for subsequent jobs

---

## Code Changes Made During Phase 3

1. **Reordered upload** — comp PNGs now upload first so preview data arrives fastest (`job_processor.py`)
2. **Fixed PHASE3_GUIDE** — added missing `pip install -e .` step
3. **Added `POLL_INTERVAL`** to `worker/.env.example`
4. **Fixed worker README** — removed stale `cd worker` before `pip install`

---

## Issues Found (for Phase 4)

### Preview UX
- **Grid view not ideal** — user wants a frame-by-frame viewer with fullscreen, arrow key navigation, and a slider/scrubber instead of a thumbnail grid
- **Preview only shows after completed** — should show comp frames as they upload, not wait for all 4 types

### Download UX
- **Single-file download** — clicking a type button downloads only one frame, should download a ZIP of all files for that type
- **No "Download All" button** — user wants one-click ZIP of everything

### Upload Phase
- **No upload progress** — UI shows "Uploading" status but no granular progress (which folder, how many files)
- **Can't browse partial results** — uploaded folders can't be viewed until everything finishes

### Nice-to-Have
- Show total processing time prominently
- Show estimated cost per job (based on GPU hourly rate)
- Test with 4K video
- Test error recovery (kill worker mid-job)

---

## What's Next (Phase 4)

Priority order:
1. Frame viewer (replace grid with arrow-key/slider scrubber)
2. ZIP downloads per type + "Download All"
3. Upload progress tracking
4. Show preview during upload phase
5. Processing time + cost display
6. Error handling test
