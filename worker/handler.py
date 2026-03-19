#!/usr/bin/env python3
"""
RunPod Serverless Handler for CorridorKey.

Receives a job_id, downloads assets from Supabase, runs CorridorKey inference,
uploads results back to Supabase. Replaces the polling worker.py for serverless.

Usage (local test):
    python handler.py --rp_serve_api --rp_api_port 8080

    curl -X POST http://localhost:8080/runsync \
      -H "Content-Type: application/json" \
      -d '{"input": {"job_id": "your-uuid"}}'
"""

import os
import sys
import logging

# Enable EXR support in OpenCV — must be set before import
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"

# Add repo root to Python path (for CorridorKeyModule imports)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# Add worker dir to path (for supabase_client, job_processor imports)
WORKER_DIR = os.path.dirname(os.path.abspath(__file__))
if WORKER_DIR not in sys.path:
    sys.path.insert(0, WORKER_DIR)

import runpod

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("handler")

# ── Load engine once at cold start (stays in memory across requests) ─────────
logger.info("Loading CorridorKey engine...")

from CorridorKeyModule.backend import create_engine

device = os.environ.get("CORRIDORKEY_DEVICE", "cuda")
backend = os.environ.get("CORRIDORKEY_BACKEND", "torch")

ENGINE = create_engine(backend=backend, device=device)
logger.info("Engine loaded on %s (%s)", device, backend)

# ── Import worker modules ────────────────────────────────────────────────────
from supabase_client import get_client, claim_next_job_fallback, recover_stale_jobs
from job_processor import process_job


def handler(job):
    """
    RunPod serverless handler.

    Input:
        {"job_id": "uuid"}  — Supabase job UUID to process

    The handler:
    1. Claims the job in Supabase (queued → preparing)
    2. Runs the full processing pipeline
    3. Updates Supabase with results (→ completed or → failed)
    """
    job_input = job["input"]
    job_id = job_input.get("job_id")

    if not job_id:
        return {"error": "Missing job_id in input"}

    logger.info("Received job: %s", job_id)

    client = get_client()
    worker_id = os.environ.get("WORKER_ID", "worker-serverless")

    # Recover any stale jobs from previous crashes
    recover_stale_jobs(client, stale_minutes=5)

    # Claim the job (queued → preparing)
    claimed = claim_next_job_fallback(client, worker_id)

    if not claimed or claimed["id"] != job_id:
        # Job may have already been claimed or doesn't exist
        # Try to fetch it directly — it might already be in preparing state
        result = client.table("jobs").select("*").eq("id", job_id).single().execute()
        if not result.data:
            return {"error": f"Job {job_id} not found"}

        job_data = result.data

        if job_data["status"] in ("completed", "failed"):
            return {"status": job_data["status"], "job_id": job_id}

        if job_data["status"] != "queued":
            # Already claimed by someone else or in progress
            logger.info("Job %s status is '%s', not queued", job_id, job_data["status"])
            return {"error": f"Job {job_id} is already {job_data['status']}"}

        # Try claiming again (race condition unlikely in single-user app)
        claimed = claim_next_job_fallback(client, worker_id)
        if not claimed:
            return {"error": f"Could not claim job {job_id}"}

    # Run the processing pipeline
    logger.info("Processing job: %s", claimed["id"])
    process_job(claimed, ENGINE, client)

    return {"status": "completed", "job_id": job_id}


runpod.serverless.start({"handler": handler})
