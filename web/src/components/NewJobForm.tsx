"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "./FileUploader";
import { DEFAULT_JOB_CONFIG } from "@/lib/types";
import type { JobConfig } from "@/lib/types";

export default function NewJobForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [config, setConfig] = useState<JobConfig>({ ...DEFAULT_JOB_CONFIG });
  const [jobId, setJobId] = useState<string | null>(null);
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [alphaPath, setAlphaPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Create draft job
  async function createDraft() {
    if (!name.trim()) {
      setError("Job name is required");
      return;
    }
    setError(null);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), config }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create job");
      return;
    }

    const job = await res.json();
    setJobId(job.id);
  }

  // Step 2: Queue job after uploads
  async function queueJob() {
    if (!jobId || !inputPath || !alphaPath) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: jobId,
        input_storage_path: inputPath,
        alpha_storage_path: alphaPath,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to queue job");
      setSubmitting(false);
      return;
    }

    // Trigger RunPod serverless endpoint (fire-and-forget)
    fetch(`/api/jobs/${jobId}/trigger`, { method: "POST" }).catch(() => {
      // Trigger failure is non-fatal — job stays queued and can be retried
    });

    router.push(`/jobs/${jobId}`);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Job name + config */}
      {!jobId ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Job Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shot_001_greenscreen"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Despill Strength
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={config.despill_strength * 10}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      despill_strength: Number(e.target.value) / 10,
                    })
                  }
                  className="flex-1 accent-zinc-400"
                />
                <span className="text-xs text-zinc-500 w-6 text-right">
                  {(config.despill_strength * 10).toFixed(0)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Refiner Scale
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={config.refiner_scale * 10}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      refiner_scale: Number(e.target.value) / 10,
                    })
                  }
                  className="flex-1 accent-zinc-400"
                />
                <span className="text-xs text-zinc-500 w-8 text-right">
                  {config.refiner_scale.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.auto_despeckle}
                onChange={(e) =>
                  setConfig({ ...config, auto_despeckle: e.target.checked })
                }
                className="rounded border-zinc-700 bg-zinc-900 accent-zinc-400"
              />
              Auto Despeckle
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={config.input_is_linear}
                onChange={(e) =>
                  setConfig({ ...config, input_is_linear: e.target.checked })
                }
                className="rounded border-zinc-700 bg-zinc-900 accent-zinc-400"
              />
              Linear Input (EXR)
            </label>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={createDraft}
            className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
          >
            Continue to Upload
          </button>
        </div>
      ) : (
        /* Upload files */
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Upload both files, then submit to queue
            </div>
          </div>

          <FileUploader
            label="Source Video (green screen footage)"
            accept=".mp4,.mov,.avi,.mkv"
            jobId={jobId}
            fileType="input"
            onUploaded={setInputPath}
          />

          <FileUploader
            label="Alpha Hint (rough matte video)"
            accept=".mp4,.mov,.avi,.mkv,.png,.jpg,.exr"
            jobId={jobId}
            fileType="alpha"
            onUploaded={setAlphaPath}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={queueJob}
            disabled={!inputPath || !alphaPath || submitting}
            className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Queuing..." : "Submit Job"}
          </button>
        </div>
      )}
    </div>
  );
}
