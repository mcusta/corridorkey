import type { JobStatus } from "./types";

export const STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  preparing: "Preparing",
  processing: "Processing",
  uploading: "Uploading",
  completed: "Completed",
  failed: "Failed",
};

export const STATUS_COLORS: Record<JobStatus, string> = {
  draft: "bg-zinc-600 text-zinc-200",
  queued: "bg-amber-600/20 text-amber-400",
  preparing: "bg-blue-600/20 text-blue-400",
  processing: "bg-blue-600/20 text-blue-400",
  uploading: "bg-blue-600/20 text-blue-400",
  completed: "bg-emerald-600/20 text-emerald-400",
  failed: "bg-red-600/20 text-red-400",
};

export const TERMINAL_STATUSES: JobStatus[] = ["completed", "failed"];

export const STORAGE_BUCKET = "job-assets";

// GPU cost estimation (Runpod A4090)
export const GPU_HOURLY_RATE = 0.69; // $/hr
export const SECONDS_PER_FRAME_ESTIMATE = 1.2; // avg from real tests
