# CorridorKey Serverless Worker — RunPod
# Packages the worker + CorridorKey engine + model weights into a single image.
#
# Build (from repo root):
#   docker build --platform linux/amd64 -t ghcr.io/mcusta/corridorkey-worker:v1 -f worker/Dockerfile .
#
# Push:
#   docker push ghcr.io/mcusta/corridorkey-worker:v1

FROM pytorch/pytorch:2.6.0-cuda12.6-cudnn9-runtime

# System deps for OpenCV and EXR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libopenexr-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all source packages needed by pyproject.toml
COPY pyproject.toml README.md /app/
COPY CorridorKeyModule/ /app/CorridorKeyModule/
COPY gvm_core/ /app/gvm_core/
COPY VideoMaMaInferenceModule/ /app/VideoMaMaInferenceModule/
COPY corridorkey_cli.py /app/corridorkey_cli.py

# Install CorridorKey — use --no-deps to keep the base image's torch+CUDA,
# then install all non-torch deps separately.
RUN pip install --no-cache-dir --no-deps -e . && \
    pip install --no-cache-dir \
    timm numpy opencv-python tqdm setuptools \
    diffusers transformers accelerate peft av Pillow PIMS easydict \
    imageio matplotlib einops huggingface-hub

# Worker-specific deps + RunPod serverless SDK
COPY worker/requirements.txt /app/worker/requirements.txt
RUN pip install --no-cache-dir -r /app/worker/requirements.txt && \
    pip install --no-cache-dir runpod

# Download model weights at build time (baked into image = no cold-start download)
RUN mkdir -p /app/CorridorKeyModule/checkpoints && \
    wget -q -O /app/CorridorKeyModule/checkpoints/CorridorKey.pth \
    https://huggingface.co/nikopueringer/CorridorKey_v1.0/resolve/main/CorridorKey_v1.0.pth

# Copy worker code
COPY worker/ /app/worker/

# Set env defaults
ENV CORRIDORKEY_DEVICE=cuda \
    CORRIDORKEY_BACKEND=torch \
    WORKER_ID=worker-serverless \
    TEMP_DIR=/tmp/ck_jobs \
    OPENCV_IO_ENABLE_OPENEXR=1

# Handler is the entrypoint
CMD ["python", "-u", "/app/worker/handler.py"]
