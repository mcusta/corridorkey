"use client";

import { useState, useEffect } from "react";

const FILE_TYPES = ["comp", "fg", "matte", "processed"] as const;

export default function UploadProgress({
  jobId,
  totalFrames,
}: {
  jobId: string;
  totalFrames: number;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const res = await fetch(`/api/jobs/${jobId}/files`);
        const data = await res.json();
        if (cancelled) return;

        const newCounts: Record<string, number> = {};
        for (const type of FILE_TYPES) {
          newCounts[type] = data.filter(
            (f: { file_type: string }) => f.file_type === type
          ).length;
        }
        setCounts(newCounts);
      } catch {
        /* ignore */
      }
    }

    fetchCounts();
    const interval = setInterval(fetchCounts, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  const totalUploaded = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalExpected = totalFrames * 4;
  const pct =
    totalExpected > 0
      ? Math.min(Math.round((totalUploaded / totalExpected) * 100), 100)
      : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>Uploading outputs</span>
        <span className="tabular-nums">
          {totalUploaded} / {totalExpected} files &middot; {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {FILE_TYPES.map((type) => {
          const count = counts[type] || 0;
          const done = count >= totalFrames;
          const active = count > 0 && !done;
          return (
            <div
              key={type}
              className={`rounded border px-2 py-1.5 text-center text-xs ${
                done
                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-400"
                  : active
                    ? "border-blue-800 bg-blue-950/20 text-blue-400"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-600"
              }`}
            >
              <div className="font-medium">{type.toUpperCase()}</div>
              <div className="mt-0.5 tabular-nums">
                {done ? "Done" : active ? `${count}/${totalFrames}` : "Pending"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
