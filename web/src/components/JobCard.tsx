"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import JobProgress from "./JobProgress";
import type { Job } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function JobCard({
  job,
  onUpdated,
}: {
  job: Job;
  onUpdated?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(job.name);
  const [deleting, setDeleting] = useState(false);

  async function handleRename() {
    if (!newName.trim() || newName.trim() === job.name) {
      setRenaming(false);
      setNewName(job.name);
      return;
    }
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setRenaming(false);
      onUpdated?.();
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${job.name}"? This removes all files and cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    if (res.ok) {
      onUpdated?.();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete job");
      setDeleting(false);
    }
  }

  const isActive = ["preparing", "processing", "uploading"].includes(job.status);

  return (
    <div
      className={`relative rounded-lg border bg-zinc-900/50 p-4 transition-colors ${
        deleting ? "opacity-50 pointer-events-none border-zinc-800" : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <Link href={`/jobs/${job.id}`} className="absolute inset-0 z-0" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleRename(); }}
              className="relative z-10 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => { if (e.key === "Escape") { setRenaming(false); setNewName(job.name); } }}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </form>
          ) : (
            <div className="text-sm font-medium truncate">{job.name}</div>
          )}
          <div className="text-xs text-zinc-500 mt-1">
            {timeAgo(job.created_at)}
            {job.total_frames && job.status === "completed" && (
              <> &middot; {job.total_frames} frames</>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />

          {/* Actions menu */}
          {!isActive && (
            <div className="relative z-10">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Actions"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); }} />
                  <div className="absolute right-0 top-8 z-30 w-36 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen(false);
                        setRenaming(true);
                        setNewName(job.name);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen(false);
                        handleDelete();
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {(job.status === "processing" || job.status === "uploading") &&
        job.total_frames && (
          <div className="mt-3">
            <JobProgress
              processed={job.processed_frames}
              total={job.total_frames}
            />
          </div>
        )}

      {job.status === "failed" && job.error_message && (
        <div className="mt-2 text-xs text-red-400 truncate">
          {job.error_message}
        </div>
      )}
    </div>
  );
}
