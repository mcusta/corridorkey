# Phase 5 — Deploy (RunPod Serverless + Vercel)

## Overview

Deploy CorridorKey as a production service:
- **GPU Worker** → RunPod Serverless (pay per second, always available)
- **Web App** → Vercel (free tier)

No more managing pods. Submit a job → GPU spins up → processes → shuts down.

---

## Cost Model

| Item | Cost |
|------|------|
| GPU (L4/3090, 24GB) | $0.68/hr — only while processing |
| GPU (4090 PRO, 24GB) | $1.12/hr — only while processing |
| 150-frame job (~3 min) | ~$0.03–0.06 |
| 10 jobs/day for a month | ~$10–17/month |
| Vercel (web hosting) | Free tier |
| Supabase (DB + Storage) | Free tier (500MB DB, 1GB storage) |

---

## Step 1: Build & Push Docker Image

You need Docker installed locally (or use a cloud build service).

### 1a. Using GitHub Container Registry (ghcr.io)
No extra account needed — uses your existing GitHub account.

### 1b. Build the image
From the repo root:
```bash
docker build --platform linux/amd64 -t ghcr.io/mcusta/corridorkey-worker:v1 -f worker/Dockerfile .
```

This will:
- Install CorridorKey + all Python deps
- Download model weights (~300MB) into the image
- Package the serverless handler

**Build time:** ~10-15 min (mostly downloading PyTorch + weights)
**Image size:** ~8-10 GB

### 1c. Push to GitHub Container Registry
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u mcusta --password-stdin
docker push ghcr.io/mcusta/corridorkey-worker:v1
```

---

## Step 2: Create RunPod Serverless Endpoint

### 2a. Go to RunPod Console
- https://www.runpod.io/console/serverless
- Click **New Endpoint**

### 2b. Configure the endpoint
| Setting | Value |
|---------|-------|
| Name | `corridorkey` |
| Docker Image | `ghcr.io/mcusta/corridorkey-worker:v1` |
| GPU | Select multiple 24GB+ GPUs for best availability: L4, RTX 3090, RTX 4090 |
| Active Workers | 0 (pay only when processing) |
| Max Workers | 1 (single user, one job at a time) |
| Idle Timeout | 30 seconds |
| Execution Timeout | 1800 seconds (30 min) |
| FlashBoot | Enabled (faster warm starts) |

### 2c. Set environment variables
In the endpoint settings, add:
```
SUPABASE_URL=https://eeuduimpwwtqzintbbeo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
```

### 2d. Note your endpoint details
- **Endpoint ID** — shown in the URL (e.g. `abc123def`)
- **API Key** — RunPod Settings → API Keys → Create Key

---

## Step 3: Test the Endpoint

### Quick test via RunPod dashboard
1. Go to your endpoint page
2. Click **Requests** → **Run**
3. Enter: `{"input": {"job_id": "some-existing-queued-job-uuid"}}`
4. Watch logs — should see engine loading, then processing

### Test via curl
```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"job_id": "YOUR_JOB_UUID"}}'
```

Check status:
```bash
curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/status/RUNPOD_JOB_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Cold start
First request triggers a cold start (~30-60s to load model into GPU memory).
Subsequent requests while the worker is warm are instant.

---

## Step 4: Connect Web App to RunPod

### 4a. Add env vars to `web/.env.local`
```
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-runpod-api-key
```

### 4b. Test locally
1. Start the web app: `cd web && npm run dev`
2. Create a new job, upload files, submit
3. The app calls `/api/jobs/[id]/trigger` which dispatches to RunPod
4. Watch the job progress in the UI

---

## Step 5: Deploy Web App to Vercel

### 5a. Push code to GitHub
```bash
git add -A
git commit -m "feat: add RunPod serverless handler + trigger API"
git push
```

### 5b. Connect to Vercel
1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Root directory: `web`
5. Build command: `npm run build`
6. Output directory: `.next`

### 5c. Set environment variables in Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://eeuduimpwwtqzintbbeo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-runpod-api-key
```

### 5d. Deploy
Click Deploy. Vercel builds and hosts your app at `your-project.vercel.app`.

---

## Step 6: End-to-End Verification

1. Open your Vercel URL
2. Log in with your Supabase credentials
3. Create a new job → upload video + alpha → submit
4. Watch: queued → preparing → processing → uploading → completed
5. Verify preview works (comp gallery + playback)
6. Verify downloads work (ZIP per type + Download All)
7. Check RunPod dashboard for execution time and cost

---

## Architecture (After Phase 5)

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  Vercel       │─────▶│     Supabase     │◀─────│  RunPod Serverless  │
│  (Next.js)   │      │  - Auth          │      │  (GPU on demand)    │
│              │──────▶│  - Postgres DB   │      │                     │
│              │  API  │  - Storage (S3)  │      │  handler.py         │
└──────────────┘      └──────────────────┘      │  job_processor.py   │
       │                                         └─────────────────────┘
       │  POST /run                                       ▲
       └─────────────────────────────────────────────────┘
              RunPod API (https://api.runpod.ai/v2/...)
```

**Flow:**
1. User submits job → web app saves to Supabase (status: queued)
2. Web app calls RunPod `/run` with job_id
3. RunPod spins up GPU worker → handler claims job → processes → uploads results
4. Web app polls Supabase and shows progress in real-time
5. GPU worker shuts down after idle timeout

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cold start too slow (~60s) | Enable FlashBoot, or set Active Workers = 1 (~$16/day always-on) |
| `CUDA out of memory` | Switch to 48GB GPU (A6000/A40) in endpoint settings |
| Job stays queued | Check RunPod logs, verify env vars are set on the endpoint |
| Trigger fails (502) | Check `RUNPOD_ENDPOINT_ID` and `RUNPOD_API_KEY` in web env |
| Image pull slow | Image is large (~10GB). First deploy takes longer, FlashBoot caches it |

---

## Fallback: Manual Trigger

If the auto-trigger fails, jobs stay in `queued` status. You can manually trigger from the RunPod dashboard or via curl. The existing polling worker (`python worker.py`) also still works as a fallback on any GPU machine.
