# Phase 3 — GPU Worker Test Guide

## Overview

Deploy the Python worker to a RunPod GPU instance, connect it to Supabase, and process the queued "Shot02-Close" job end-to-end.

---

## What Mutlu Does (Before Phase 3 Chat)

### 1. Create RunPod Account (DONE)
- Go to https://www.runpod.io and sign up
- Add **$5–10** in credits (Settings → Billing → Add Credits)

### 2. Create a GPU Pod (DONE)
- Go to **Pods → Deploy**
- Pick **Community Cloud** (cheaper)
- GPU: **RTX 4090 (24GB)** — or RTX 3090 if 4090 is unavailable
- Template: **RunPod Pytorch 2.x** (comes with CUDA + Python pre-installed)
- Container disk: **30GB** (need space for model weights ~300MB + video frames)
- Volume disk: **0GB** (not needed, we're not persisting between runs)
- Click **Deploy**

### 3. Connect to the Pod (DONE)
- Once running, click **Connect → Start Web Terminal** (or use SSH)
- You'll get a terminal on the GPU machine

### 4. Clone the Repo + Pull Fork (DONE)
The web app code lives on Mutlu's fork, not the original repo.
```bash
cd /workspace
git clone https://github.com/cmoyates/CorridorKey.git
cd CorridorKey
git remote add fork https://github.com/mcusta/CorridorKey.git
git pull fork main
```

### 5. Install Dependencies (DONE)
```bash
cd /workspace/CorridorKey
pip install -r worker/requirements.txt
```

### 6. Download Model Weights (DONE)
The checkpoint must be named exactly `CorridorKey.pth` (~300MB).
```bash
mkdir -p CorridorKeyModule/checkpoints
wget -O CorridorKeyModule/checkpoints/CorridorKey.pth https://huggingface.co/nikopueringer/CorridorKey_v1.0/resolve/main/CorridorKey_v1.0.pth
```

### 7. Create Worker Env File (DONE)
Replace the placeholder values with your real Supabase keys.
```bash
cat > worker/.env << 'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-key-here
CORRIDORKEY_DEVICE=cuda
CORRIDORKEY_BACKEND=torch
WORKER_ID=worker-runpod-01
TEMP_DIR=/tmp/ck_jobs
HEARTBEAT_STALE_MINUTES=5
EOF
```

### 8. Tell Claude "Do Phase 3"
- **Stop the pod** to save money (restart it when ready)
- Open a new chat
- Say: **"Do Phase 3. My RunPod pod is prepped and ready to start."**
- Claude will review the worker code, help you run it, and troubleshoot

---

## What Claude Does (During Phase 3 Chat)

1. Read phase docs + previous reports for context
2. Review worker code (`worker.py`, `job_processor.py`, etc.)
3. Verify worker dependencies and imports are correct
4. Help run `python worker.py` and debug any issues
5. Monitor job status progression: queued → preparing → processing → uploading → completed
6. Verify output files in Supabase Storage
7. Verify web UI shows results (preview + download)
8. Test error handling if time permits
9. Write `PHASE3_REPORT.md` and update `PHASES.md`

---

## Expected Job Flow

```
Worker starts
  → Recovers any stale jobs (heartbeat > 5min)
  → Polls for queued jobs every 5s
  → Finds "Shot02-Close" job
  → Claims it (status: preparing)
  → Downloads input.mp4 + alpha.mp4 from Supabase Storage
  → Extracts frames via OpenCV
  → Loads CorridorKey engine (takes ~10-20s, uses ~22.7GB VRAM)
  → Processes frames one by one (status: processing, progress updates)
  → Uploads outputs to Storage (status: uploading)
  → Inserts job_files rows for each output
  → Marks job completed
```

---

## GPU Requirements

- **CorridorKey inference**: 22.7GB VRAM at 2048×2048 resolution
- **Minimum**: 24GB GPU (RTX 3090/4090/5090)
- **Recommended**: Cloud GPU with no display attached (gets full 24GB)
- **If OOM**: Scale up to A40 (48GB, ~$0.50/hr) — no code changes needed

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `CUDA out of memory` | Scale up to A40 (48GB) — just stop pod, deploy new one |
| `ModuleNotFoundError` | Missing pip package — `pip install <package>` |
| `Checkpoint not found` | Model weights not at `CorridorKeyModule/checkpoints/CorridorKey.pth` |
| `Connection refused` (Supabase) | Check `worker/.env` has correct URL and key |
| Worker hangs on poll | Check Supabase `jobs` table has a row with `status=queued` |
| `worker/` dir missing | Need to pull from fork: `git pull fork main` |

---

## Cost Estimate

| Item | Cost |
|------|------|
| RunPod RTX 4090, ~1hr setup + test | ~$0.34 |
| Processing one job (~10-30min) | ~$0.06–0.17 |
| **Total Phase 3** | **< $1.00** |

Stop the pod immediately after testing to avoid charges.

---

## Checklist

- [x] RunPod account created + credits added
- [x] GPU pod deployed (RTX 4090 or equivalent)
- [x] Repo cloned on pod (with fork pulled)
- [x] Worker deps installed
- [x] Model weights downloaded
- [x] `worker/.env` configured
- [ ] Worker runs and picks up queued job
- [ ] Job completes successfully
- [ ] Output files visible in Supabase Storage
- [ ] Web UI shows completed job with preview + download
- [ ] Phase 3 report written
