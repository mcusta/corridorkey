# CorridorKey GPU Worker

Polls Supabase for queued jobs, runs CorridorKey inference, uploads results.

## Requirements

- Linux with CUDA GPU (24GB+ VRAM — RTX 3090/4090/5090)
- Python 3.10+
- CorridorKey repo cloned with model weights downloaded

## Setup on Runpod (or similar)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/CorridorKey.git
cd CorridorKey

# 2. Install CorridorKey dependencies
pip install -e .
# or with uv:
uv sync

# 3. Download model weights
uv run hf download nikopueringer/CorridorKey_v1.0 \
  --local-dir CorridorKeyModule/checkpoints

# 4. Install worker dependencies
pip install -r worker/requirements.txt

# 5. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 6. Run the worker
python worker.py
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | required |
| `CORRIDORKEY_DEVICE` | PyTorch device | `cuda` |
| `CORRIDORKEY_BACKEND` | Engine backend | `torch` |
| `WORKER_ID` | Unique worker identifier | `worker-01` |
| `TEMP_DIR` | Temp directory for job files | `/tmp/ck_jobs` |
| `HEARTBEAT_STALE_MINUTES` | Minutes before a job is considered stale | `5` |
| `POLL_INTERVAL` | Seconds between job polls | `5` |

## Running as a service

```bash
# Simple: run in tmux
tmux new -s worker
python worker.py

# Or use systemd
# Create /etc/systemd/system/ck-worker.service
```

## Graceful shutdown

Send SIGINT or SIGTERM — the worker finishes the current job before exiting.
