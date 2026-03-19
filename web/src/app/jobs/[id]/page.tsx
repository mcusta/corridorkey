"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import JobProgress from "@/components/JobProgress";
import OutputPreview from "@/components/OutputPreview";
import DownloadButton from "@/components/DownloadButton";
import UploadProgress from "@/components/UploadProgress";
import { TERMINAL_STATUSES, GPU_HOURLY_RATE, SECONDS_PER_FRAME_ESTIMATE } from "@/lib/constants";
import type { Job, JobConfig } from "@/lib/types";

function ConfigDisplay({ config }: { config: JobConfig }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <div>
        <span className="text-zinc-500">Despill</span>
        <div className="text-zinc-300 mt-0.5">
          {(config.despill_strength * 10).toFixed(0)}/10
        </div>
      </div>
      <div>
        <span className="text-zinc-500">Refiner</span>
        <div className="text-zinc-300 mt-0.5">
          {config.refiner_scale.toFixed(1)}x
        </div>
      </div>
      <div>
        <span className="text-zinc-500">Despeckle</span>
        <div className="text-zinc-300 mt-0.5">
          {config.auto_despeckle ? "On" : "Off"}
        </div>
      </div>
      <div>
        <span className="text-zinc-500">Input</span>
        <div className="text-zinc-300 mt-0.5">
          {config.input_is_linear ? "Linear" : "sRGB"}
        </div>
      </div>
    </div>
  );
}

function formatDuration(startStr: string, endStr: string): string {
  const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hr}h ${remainMin}m`;
}

function estimateCost(job: Job): { cost: number; isEstimate: boolean } | null {
  if (job.started_at && job.completed_at) {
    const ms = new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
    return { cost: (ms / 3_600_000) * GPU_HOURLY_RATE, isEstimate: false };
  }
  if (job.total_frames) {
    const sec = job.total_frames * SECONDS_PER_FRAME_ESTIMATE;
    return { cost: (sec / 3600) * GPU_HOURLY_RATE, isEstimate: true };
  }
  return null;
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  async function fetchJob() {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) {
        setError("Job not found");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setJob(data);
    } catch {
      setError("Failed to load job");
    }
    setLoading(false);
  }

  async function handleRename() {
    if (!newName.trim() || newName.trim() === job?.name) {
      setRenaming(false);
      return;
    }
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setRenaming(false);
      fetchJob();
    }
  }

  async function handleDelete() {
    if (!job) return;
    if (!confirm(`Delete "${job.name}"? This removes all files and cannot be undone.`)) return;
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/jobs");
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete job");
    }
  }

  useEffect(() => {
    fetchJob();

    // Poll while job is in progress
    const interval = setInterval(() => {
      if (job && TERMINAL_STATUSES.includes(job.status)) return;
      fetchJob();
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job?.status]);

  const isActive = job && ["preparing", "processing", "uploading"].includes(job.status);
  const costInfo = job ? estimateCost(job) : null;

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-sm text-zinc-500">Loading...</div>
        </main>
      </>
    );
  }

  if (error || !job) {
    return (
      <>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-sm text-red-400">{error || "Job not found"}</div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mt-4 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
            Back to Jobs
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Back nav */}
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back to Jobs
        </Link>

        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {renaming ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleRename(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => { if (e.key === "Escape") setRenaming(false); }}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-lg font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                </form>
              ) : (
                <h1 className="text-lg font-semibold truncate">{job.name}</h1>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={job.status} />
              {!isActive && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setRenaming(true); setNewName(job.name); }}
                    className="cursor-pointer p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Rename"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 1.5l2.5 2.5M1.5 12.5l.7-2.8L9.5 2.4l2.1 2.1-7.3 7.3-2.8.7z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="cursor-pointer p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3.5h10M5 3.5V2a1 1 0 011-1h2a1 1 0 011 1v1.5M11 3.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1.5 flex-wrap">
            <span>Created {new Date(job.created_at).toLocaleString()}</span>
            {job.completed_at && (
              <>
                <span>&middot;</span>
                <span>Completed {new Date(job.completed_at).toLocaleString()}</span>
              </>
            )}
            {job.started_at && job.completed_at && (
              <>
                <span>&middot;</span>
                <span>{formatDuration(job.started_at, job.completed_at)}</span>
              </>
            )}
            {job.total_frames && TERMINAL_STATUSES.includes(job.status) && (
              <>
                <span>&middot;</span>
                <span>{job.total_frames} frames</span>
              </>
            )}
            {costInfo && (
              <>
                <span>&middot;</span>
                <span>
                  {costInfo.isEstimate ? "~" : ""}${costInfo.cost.toFixed(3)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Config */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Settings
          </h2>
          <ConfigDisplay config={job.config} />
        </div>

        {/* Progress */}
        {(job.status === "processing" || job.status === "uploading") &&
          job.total_frames && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              {job.status === "processing" ? (
                <JobProgress
                  processed={job.processed_frames}
                  total={job.total_frames}
                />
              ) : (
                <UploadProgress
                  jobId={job.id}
                  totalFrames={job.total_frames}
                />
              )}
            </div>
          )}

        {/* Queued / Preparing state */}
        {(job.status === "queued" || job.status === "preparing") && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
            {job.status === "queued"
              ? "Waiting for GPU worker to pick up this job..."
              : "Worker is preparing — downloading files and setting up..."}
          </div>
        )}

        {/* Error */}
        {job.status === "failed" && job.error_message && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <h2 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-1">
              Error
            </h2>
            <p className="text-sm text-red-300 whitespace-pre-wrap">
              {job.error_message}
            </p>
          </div>
        )}

        {/* Outputs — show during uploading (live preview) and completed */}
        {(job.status === "uploading" || job.status === "completed") && (
          <div className="space-y-6">
            <OutputPreview
              jobId={job.id}
              isUploading={job.status === "uploading"}
            />
            {job.status === "completed" && (
              <DownloadButton jobId={job.id} jobName={job.name} />
            )}
          </div>
        )}
      </main>
    </>
  );
}
