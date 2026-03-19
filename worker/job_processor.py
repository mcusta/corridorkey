"""
Job processor: downloads assets, runs CorridorKey inference, uploads results.
Mirrors the frame loop from clip_manager.py:611-733.
"""

import os
import shutil
import logging
import traceback

import cv2
import numpy as np

from supabase_client import (
    download_file,
    upload_file,
    update_job,
    update_progress,
    fail_job,
    complete_job,
    insert_job_file,
)

logger = logging.getLogger(__name__)

# EXR save flags — from clip_manager.py:701-706
EXR_FLAGS = [
    cv2.IMWRITE_EXR_TYPE,
    cv2.IMWRITE_EXR_TYPE_HALF,
    cv2.IMWRITE_EXR_COMPRESSION,
    cv2.IMWRITE_EXR_COMPRESSION_PXR24,
]


def process_job(job: dict, engine, client) -> None:
    """
    Full job processing pipeline:
    1. Download assets from Supabase Storage
    2. Extract video frames
    3. Run CorridorKey inference frame-by-frame
    4. Upload outputs
    5. Update DB
    """
    job_id = job["id"]
    config = job["config"]
    temp_dir = os.path.join(os.environ.get("TEMP_DIR", "/tmp/ck_jobs"), job_id)

    try:
        _run_pipeline(job_id, config, engine, client, temp_dir)
    except Exception as e:
        logger.error("Job %s failed: %s\n%s", job_id, e, traceback.format_exc())
        fail_job(client, job_id, str(e))
    finally:
        # Cleanup temp files
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info("Cleaned up %s", temp_dir)


def _sanitize_name(name: str) -> str:
    """Sanitize job name for use in filenames."""
    import re
    # Replace spaces and unsafe chars with underscores, collapse multiples
    s = re.sub(r'[^\w\-.]', '_', name)
    s = re.sub(r'_+', '_', s).strip('_')
    return s or "job"


def _run_pipeline(
    job_id: str, config: dict, engine, client, temp_dir: str
) -> None:
    from frame_utils import extract_frames

    # --- Step 1: Download assets ---
    logger.info("Job %s: downloading assets", job_id)

    # Get job details for storage paths
    result = client.table("jobs").select("*").eq("id", job_id).single().execute()
    job_data = result.data

    job_name = _sanitize_name(job_data.get("name", "job"))

    input_path = job_data["input_storage_path"]
    alpha_path = job_data["alpha_storage_path"]

    if not input_path or not alpha_path:
        raise ValueError("Missing input or alpha storage path")

    input_ext = os.path.splitext(input_path)[1] or ".mp4"
    alpha_ext = os.path.splitext(alpha_path)[1] or ".mp4"

    local_input = os.path.join(temp_dir, f"input{input_ext}")
    local_alpha = os.path.join(temp_dir, f"alpha{alpha_ext}")

    download_file(client, input_path, local_input)
    download_file(client, alpha_path, local_alpha)

    # --- Step 2: Extract frames ---
    logger.info("Job %s: extracting frames", job_id)

    input_frames_dir = os.path.join(temp_dir, "Input")
    alpha_frames_dir = os.path.join(temp_dir, "AlphaHint")

    # Check if alpha is a single image (not video)
    alpha_is_image = alpha_ext.lower() in (".png", ".jpg", ".jpeg", ".exr", ".tif")

    num_input_frames = extract_frames(local_input, input_frames_dir, grayscale=False)
    if num_input_frames == 0:
        raise ValueError("Input video has 0 frames")

    if alpha_is_image:
        # Single image alpha — copy it for each frame
        os.makedirs(alpha_frames_dir, exist_ok=True)
        # Read the single image and write copies
        alpha_img = cv2.imread(local_alpha, cv2.IMREAD_UNCHANGED)
        if alpha_img is None:
            raise ValueError("Cannot read alpha hint image")
        for i in range(num_input_frames):
            cv2.imwrite(os.path.join(alpha_frames_dir, f"{i:05d}.png"), alpha_img)
        num_alpha_frames = num_input_frames
    else:
        num_alpha_frames = extract_frames(
            local_alpha, alpha_frames_dir, grayscale=True
        )

    num_frames = min(num_input_frames, num_alpha_frames)
    logger.info(
        "Job %s: %d input frames, %d alpha frames, processing %d",
        job_id,
        num_input_frames,
        num_alpha_frames,
        num_frames,
    )

    # --- Step 3: Update status to processing ---
    update_job(
        client,
        job_id,
        status="processing",
        total_frames=num_frames,
        processed_frames=0,
    )

    # --- Step 4: Create output directories ---
    fg_dir = os.path.join(temp_dir, "Output", "FG")
    matte_dir = os.path.join(temp_dir, "Output", "Matte")
    comp_dir = os.path.join(temp_dir, "Output", "Comp")
    proc_dir = os.path.join(temp_dir, "Output", "Processed")
    for d in [fg_dir, matte_dir, comp_dir, proc_dir]:
        os.makedirs(d, exist_ok=True)

    # --- Step 5: Frame-by-frame inference ---
    # Mirrors clip_manager.py:611-733
    input_files = sorted(os.listdir(input_frames_dir))
    alpha_files = sorted(os.listdir(alpha_frames_dir))

    input_is_linear = config.get("input_is_linear", False)
    despill_strength = config.get("despill_strength", 0.5)
    auto_despeckle = config.get("auto_despeckle", True)
    despeckle_size = config.get("despeckle_size", 400)
    refiner_scale = config.get("refiner_scale", 1.0)

    for i in range(num_frames):
        frame_stem = f"{i:05d}"

        # Read input frame
        input_fpath = os.path.join(input_frames_dir, input_files[i])
        img_bgr = cv2.imread(input_fpath)
        if img_bgr is None:
            logger.warning("Job %s: skipping unreadable frame %d", job_id, i)
            continue
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_srgb = img_rgb.astype(np.float32) / 255.0

        # Read alpha frame
        alpha_fpath = os.path.join(alpha_frames_dir, alpha_files[i])
        mask_in = cv2.imread(
            alpha_fpath, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_UNCHANGED
        )
        if mask_in is None:
            logger.warning("Job %s: skipping unreadable alpha %d", job_id, i)
            continue

        # Normalize mask to float32
        if mask_in.ndim == 3:
            mask_linear = mask_in[:, :, 0]
        else:
            mask_linear = mask_in

        if mask_linear.dtype == np.uint8:
            mask_linear = mask_linear.astype(np.float32) / 255.0
        elif mask_linear.dtype == np.uint16:
            mask_linear = mask_linear.astype(np.float32) / 65535.0
        else:
            mask_linear = mask_linear.astype(np.float32)

        # Resize mask if dimensions mismatch
        if mask_linear.shape[:2] != img_srgb.shape[:2]:
            mask_linear = cv2.resize(
                mask_linear,
                (img_srgb.shape[1], img_srgb.shape[0]),
                interpolation=cv2.INTER_LINEAR,
            )

        # Run inference
        res = engine.process_frame(
            img_srgb,
            mask_linear,
            input_is_linear=input_is_linear,
            fg_is_straight=True,
            despill_strength=despill_strength,
            auto_despeckle=auto_despeckle,
            despeckle_size=despeckle_size,
            refiner_scale=refiner_scale,
        )

        pred_fg = res["fg"]  # sRGB
        pred_alpha = res["alpha"]  # Linear

        # Save FG (EXR)
        fg_bgr = cv2.cvtColor(pred_fg, cv2.COLOR_RGB2BGR)
        cv2.imwrite(
            os.path.join(fg_dir, f"{frame_stem}.exr"), fg_bgr, EXR_FLAGS
        )

        # Save Matte (EXR)
        if pred_alpha.ndim == 3:
            pred_alpha = pred_alpha[:, :, 0]
        cv2.imwrite(
            os.path.join(matte_dir, f"{frame_stem}.exr"), pred_alpha, EXR_FLAGS
        )

        # Save Comp (PNG)
        comp_srgb = res["comp"]
        comp_bgr = cv2.cvtColor(
            (np.clip(comp_srgb, 0.0, 1.0) * 255.0).astype(np.uint8),
            cv2.COLOR_RGB2BGR,
        )
        cv2.imwrite(os.path.join(comp_dir, f"{frame_stem}.png"), comp_bgr)

        # Save Processed (RGBA EXR)
        if "processed" in res:
            proc_rgba = res["processed"]
            proc_bgra = cv2.cvtColor(proc_rgba, cv2.COLOR_RGBA2BGRA)
            cv2.imwrite(
                os.path.join(proc_dir, f"{frame_stem}.exr"), proc_bgra, EXR_FLAGS
            )

        # Update progress every 5 frames
        if (i + 1) % 5 == 0 or (i + 1) == num_frames:
            update_progress(client, job_id, i + 1)

        if (i + 1) % 50 == 0:
            logger.info("Job %s: processed frame %d/%d", job_id, i + 1, num_frames)

    # --- Step 6: Upload outputs ---
    logger.info("Job %s: uploading outputs", job_id)
    update_job(client, job_id, status="uploading")

    output_dirs = [
        ("comp", comp_dir),       # PNGs first — small, enables preview in UI immediately
        ("fg", fg_dir),
        ("matte", matte_dir),
        ("processed", proc_dir),
    ]

    for file_type, dir_path in output_dirs:
        if not os.path.exists(dir_path):
            continue
        files = sorted(os.listdir(dir_path))
        for fname in files:
            local_fpath = os.path.join(dir_path, fname)
            storage_path = f"{job_id}/output/{file_type}/{fname}"

            upload_file(client, local_fpath, storage_path)

            # Extract frame number from filename
            frame_num = None
            stem = os.path.splitext(fname)[0]
            ext = os.path.splitext(fname)[1]
            if stem.isdigit():
                frame_num = int(stem)

            # Display name: Shot02-Close_comp_00000.png
            display_name = f"{job_name}_{file_type}_{stem}{ext}"

            insert_job_file(
                client,
                job_id,
                file_type,
                storage_path,
                display_name,
                frame_number=frame_num,
            )

    # --- Step 7: Mark complete ---
    complete_job(client, job_id)
    logger.info("Job %s: completed successfully", job_id)
