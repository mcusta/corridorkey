# Phase 6 — Hub Architecture + MatAnyone2

**Goal:** Transform AI FX Lab from a single-tool app into a multi-tool hub. Add MatAnyone2 (video matting) as the second tool alongside CorridorKey (green screen keying).

---

## Prerequisites

Read these before starting:
- `docs/webapp/PHASE5_REPORT.md` — current state of the app
- `docs/webapp/PHASES.md` — checklist to follow
- `docs/webapp/PLAN.md` — original architecture (for context)
- Current app: https://fxlab.vercel.app

---

## Architecture Overview

### Current (Phase 5)
```
/login          → auth
/jobs           → job list
/jobs/new       → CorridorKey-only upload form
/jobs/[id]      → job detail + preview + download
```

### Target (Phase 6)
```
/               → Home page: tool selector cards
/tools/corridorkey/new  → CorridorKey upload form (moved from /jobs/new)
/tools/matanyone/new    → MatAnyone2 upload + mask selector (NEW)
/jobs           → job list (all tools, shows engine badge)
/jobs/[id]      → shared job detail (works for both engines)
```

### Data Flow — MatAnyone2 Job
```
1. User uploads video on /tools/matanyone/new
2. First frame extracted (client-side, canvas)
3. User clicks on person → MobileSAM generates mask in browser (ONNX)
4. User confirms mask
5. Video + mask PNG uploaded to Supabase Storage
6. Job created with engine="matanyone2", status=queued
7. RunPod triggered → worker routes to MatAnyone2 processor
8. MatAnyone2 outputs: _pha.mp4 (alpha) + _fgr.mp4 (foreground)
9. Worker uploads videos to Supabase Storage
10. Job detail page shows video preview + download
```

---

## Step-by-Step Implementation

### Step 1: Database — Add `engine` column

Run in Supabase SQL Editor:
```sql
ALTER TABLE jobs ADD COLUMN engine TEXT NOT NULL DEFAULT 'corridorkey';
```

Update `web/src/lib/types.ts`:
```typescript
// Add to Job type
engine: "corridorkey" | "matanyone2";
```

### Step 2: Home Page — Tool Selector

Create `web/src/app/page.tsx` (replace current redirect):
- Dark card grid with 2 cards: CorridorKey, MatAnyone2
- Each card: icon/image, title, short description, "Launch" button
- CorridorKey → `/tools/corridorkey/new`
- MatAnyone2 → `/tools/matanyone/new`
- Future-proof: easy to add more cards later

Design reference:
```
┌─────────────────────────────────────────┐
│              AI FX Lab                  │
│         Choose your tool                │
│                                         │
│  ┌───────────────┐ ┌───────────────┐   │
│  │  CorridorKey  │ │  MatAnyone2   │   │
│  │               │ │               │   │
│  │ Green screen  │ │ Video matting │   │
│  │ keying        │ │ (any bg)      │   │
│  │               │ │               │   │
│  │  [Launch →]   │ │  [Launch →]   │   │
│  └───────────────┘ └───────────────┘   │
└─────────────────────────────────────────┘
```

### Step 3: Move CorridorKey Form

- Move `web/src/app/jobs/new/page.tsx` → `web/src/app/tools/corridorkey/new/page.tsx`
- Update all links pointing to `/jobs/new` → `/tools/corridorkey/new`
- Update Navbar "+ New Job" button to point to home page `/` (tool selector)
- Add `engine: "corridorkey"` to the job creation payload

### Step 4: MatAnyone2 Upload Page

Create `web/src/app/tools/matanyone/new/page.tsx`:

**Layout:**
```
┌─────────────────────────────────────┐
│ ← Back to Home    MatAnyone2        │
├─────────────────────────────────────┤
│                                     │
│  1. Upload Video                    │
│  ┌─────────────────────────────┐   │
│  │  Drag & drop or click       │   │
│  │  MP4, MOV (max 500MB)       │   │
│  └─────────────────────────────┘   │
│                                     │
│  2. Select Subject (first frame)    │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │  [First frame displayed]    │   │
│  │  Click on person to select  │   │
│  │  Green = include, Red = exc │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│  [Undo] [Clear] [Confirm Mask]     │
│                                     │
│  3. Config                          │
│  Warmup frames: [10]               │
│  Erode radius:  [10]               │
│  Dilate radius: [10]               │
│                                     │
│  [Submit Job]                       │
└─────────────────────────────────────┘
```

**Key features:**
- Video upload → extract first frame on client via `<video>` + `<canvas>`
- Display first frame in a click-able canvas
- On click: run MobileSAM to generate mask (see Step 5)
- Show mask overlay (semi-transparent colored overlay)
- Support positive clicks (green dots, include) and negative clicks (red dots, exclude)
- Undo last click, clear all clicks
- When satisfied → "Confirm Mask" renders final binary mask PNG
- Submit: upload video + mask PNG to Supabase, create job with `engine: "matanyone2"`

### Step 5: Browser-Side MobileSAM (ONNX)

**Package:** `@xenova/transformers` (Transformers.js) — runs ONNX models in browser via WebAssembly/WebGPU.

**How it works:**
1. Install: `npm install @xenova/transformers`
2. On video upload, extract first frame as ImageData
3. Load MobileSAM model (ONNX, ~10MB, cached after first load):
   ```typescript
   import { SamModel, AutoProcessor, RawImage } from "@xenova/transformers";
   const model = await SamModel.from_pretrained("Xenova/slimsam-77-uniform");
   const processor = await AutoProcessor.from_pretrained("Xenova/slimsam-77-uniform");
   ```
4. On each click, run inference:
   ```typescript
   const image = await RawImage.fromURL(firstFrameDataURL);
   const image_inputs = await processor(image);
   // Encode image once (reuse for each click)
   const image_embeddings = await model.get_image_embeddings(image_inputs);

   // For each click set:
   const outputs = await model({
     ...image_embeddings,
     input_points: [[[clickX, clickY]]],  // normalized coords
     input_labels: [[1]],  // 1=positive, 0=negative
   });
   const masks = await processor.post_process_masks(
     outputs.pred_masks, image_inputs.original_sizes, image_inputs.reshaped_input_sizes
   );
   ```
5. Render mask overlay on canvas (semi-transparent blue/green)
6. Support accumulating multiple clicks (positive + negative)
7. When user confirms, render final binary mask to a PNG blob

**Model choice:** `Xenova/slimsam-77-uniform` (~10MB) — lightweight SAM variant optimized for browser. Fast enough for interactive use.

**Alternative:** `Xenova/sam-vit-base` (~90MB) — more accurate but slower to download.

**IMPORTANT:** Image embeddings should be computed once per frame, then reused for all click iterations. Only the point prompts change per click.

### Step 6: Update Job Creation API

Update `web/src/app/api/jobs/route.ts` (POST handler):
- Accept `engine` field in request body
- Store in `jobs.engine` column
- MatAnyone2 jobs: only need video input + mask (no alpha hint file)
- Adjust the "queued" transition logic:
  - CorridorKey: needs `input_storage_path` + `alpha_storage_path`
  - MatAnyone2: needs `input_storage_path` + `mask_storage_path` (add column or use alpha_storage_path for mask)

**Decision:** Reuse `alpha_storage_path` column for the MatAnyone2 mask PNG. Both are "secondary input files" and the column serves the same purpose. No schema migration needed beyond adding `engine`.

### Step 7: Update Job List & Detail Pages

**Jobs list (`/jobs`):**
- Add engine badge/icon on each JobCard (small label: "CorridorKey" or "MatAnyone2")
- Everything else stays the same

**Job detail (`/jobs/[id]`):**
- CorridorKey jobs: show frame gallery (comp PNGs) — existing behavior
- MatAnyone2 jobs: show video preview (`<video>` tag for `_pha.mp4` and `_fgr.mp4`)
- Download buttons: adapt labels per engine
  - CorridorKey: Matte, FG, Processed, Comp (ZIP of frames)
  - MatAnyone2: Alpha Matte (video), Foreground (video)

### Step 8: Worker — MatAnyone2 Processor

Create `worker/matanyone2_processor.py`:
```python
from matanyone2 import MatAnyone2, InferenceCore

def load_matanyone2_model(device="cuda"):
    """Load MatAnyone2 model at cold start."""
    model = MatAnyone2.from_pretrained("PeiqingYang/MatAnyone2")
    processor = InferenceCore(model, device=device)
    return processor

def process_matanyone2_job(job, processor, client):
    """
    Download video + mask from Supabase, run MatAnyone2, upload results.
    """
    # 1. Download input video and mask PNG from Supabase Storage
    # 2. Run processor.process_video(input_path, mask_path, output_dir, ...)
    # 3. Upload _pha.mp4 and _fgr.mp4 to Supabase Storage
    # 4. Create job_files rows for each output
    # 5. Update job status to completed
```

### Step 9: Worker — Update handler.py

Modify `worker/handler.py`:
```python
# At cold start, load both engines:
ENGINE_CK = create_engine(backend=backend, device=device)
ENGINE_MA = load_matanyone2_model(device=device)

def handler(job):
    job_input = job["input"]
    job_id = job_input.get("job_id")

    # Fetch job from Supabase to get engine type
    job_data = client.table("jobs").select("*").eq("id", job_id).single().execute().data

    if job_data["engine"] == "matanyone2":
        process_matanyone2_job(job_data, ENGINE_MA, client)
    else:
        process_job(job_data, ENGINE_CK, client)

    return {"status": "completed", "job_id": job_id}
```

### Step 10: Update Dockerfile

Add MatAnyone2 to `worker/Dockerfile`:
```dockerfile
# After existing pip installs:
RUN pip install --no-cache-dir matanyone2
# Or clone and install:
RUN git clone https://github.com/pq-yang/MatAnyone2 /app/MatAnyone2 \
    && pip install --no-cache-dir -e /app/MatAnyone2
```

**Note:** MatAnyone2 model weights (~141MB) auto-download on first inference. To bake them in:
```dockerfile
RUN python -c "from matanyone2 import MatAnyone2; MatAnyone2.from_pretrained('PeiqingYang/MatAnyone2')"
```

### Step 11: Rebuild & Deploy

1. Build Docker image v2:
   ```bash
   docker build -t ghcr.io/mcusta/corridorkey-worker:v2 -f worker/Dockerfile .
   ```
2. Push to GHCR:
   ```bash
   docker push ghcr.io/mcusta/corridorkey-worker:v2
   ```
3. Update RunPod endpoint to use `:v2` image
4. Deploy web app: `npx vercel --prod`
5. Run Supabase migration (ALTER TABLE)

### Step 12: End-to-End Test

1. Open https://fxlab.vercel.app
2. Click MatAnyone2 on home page
3. Upload a video with a person
4. Click on the person in the first frame → see mask overlay
5. Confirm mask → submit job
6. Watch progress on job page
7. Download alpha matte + foreground video
8. Verify quality

---

## Key Technical Notes

### MobileSAM in Browser
- Model: `Xenova/slimsam-77-uniform` (~10MB ONNX)
- First load: ~3-5 sec (download + WASM init)
- Subsequent clicks: <100ms (image embedding cached)
- Works in all modern browsers (Chrome, Firefox, Safari)
- No GPU required for mask generation

### MatAnyone2 Output Format
- Unlike CorridorKey (frame sequences), MatAnyone2 outputs **video files**
- `_pha.mp4` — alpha matte (grayscale video)
- `_fgr.mp4` — foreground composited video
- Job detail page needs to handle both frame galleries (CK) and video players (MA)

### Docker Image Size
- Current: 7.32 GB (CorridorKey only)
- Expected: ~7.5 GB (adding MatAnyone2 ~141MB model + deps)
- Cold start impact: minimal (< 30 sec extra)

### VRAM Usage
- CorridorKey: ~8-12 GB
- MatAnyone2: ~4-8 GB
- Both loaded simultaneously: ~16-20 GB → fits on RTX 4090 (24 GB)

### Supabase Storage for Videos
- MatAnyone2 output videos are typically smaller than CorridorKey frame sequences
- A 100-frame video at 1080p: ~5-15 MB per output video vs ~200+ MB for frame PNGs
- Better for the 1GB free tier storage limit

---

## Files to Create/Modify

### New Files
- `web/src/app/page.tsx` — Home page (tool selector)
- `web/src/app/tools/corridorkey/new/page.tsx` — Moved CK form
- `web/src/app/tools/matanyone/new/page.tsx` — MA upload + mask page
- `web/src/components/MaskSelector.tsx` — Interactive SAM mask component
- `worker/matanyone2_processor.py` — MA processing logic

### Modified Files
- `web/src/lib/types.ts` — Add `engine` to Job type
- `web/src/app/api/jobs/route.ts` — Accept `engine` in POST
- `web/src/app/jobs/page.tsx` — Show engine badge on cards
- `web/src/app/jobs/[id]/page.tsx` — Handle video preview for MA jobs
- `web/src/components/JobCard.tsx` — Engine badge
- `web/src/components/Navbar.tsx` — Update "+ New Job" → links to home
- `web/src/components/OutputPreview.tsx` — Video player for MA outputs
- `web/src/components/DownloadButton.tsx` — Video download for MA
- `worker/handler.py` — Route by engine, load both models
- `worker/Dockerfile` — Add MatAnyone2 install + weights
- `supabase/schema.sql` — Add engine column (for reference)

### NPM Packages to Add
- `@xenova/transformers` — Browser-side SAM inference (ONNX)
