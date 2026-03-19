"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";

interface DownloadFile {
  file_name: string;
  file_type: string;
  url: string | null;
}

export default function DownloadButton({
  jobId,
  jobName,
}: {
  jobId: string;
  jobName: string;
}) {
  const [files, setFiles] = useState<DownloadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipping, setZipping] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/files`)
      .then((r) => r.json())
      .then((data) => {
        setFiles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jobId]);

  const fileTypes = ["matte", "fg", "processed", "comp"] as const;

  async function downloadZip(typeFiles: DownloadFile[], zipName: string) {
    const zip = new JSZip();
    const folder = zip.folder(zipName)!;

    await Promise.all(
      typeFiles.map(async (f) => {
        if (!f.url) return;
        const res = await fetch(f.url);
        const blob = await res.blob();
        folder.file(f.file_name, blob);
      })
    );

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${zipName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadType(type: string) {
    const typeFiles = files.filter((f) => f.file_type === type && f.url);
    if (typeFiles.length === 0) return;
    setZipping(type);
    try {
      await downloadZip(typeFiles, `${jobName}_${type}`);
    } catch {
      alert("Download failed. Please try again.");
    }
    setZipping(null);
  }

  async function handleDownloadAll() {
    const allFiles = files.filter((f) => f.url);
    if (allFiles.length === 0) return;
    setZipping("all");
    try {
      const zip = new JSZip();
      const root = zip.folder(jobName)!;

      await Promise.all(
        allFiles.map(async (f) => {
          if (!f.url) return;
          const folder = root.folder(f.file_type)!;
          const res = await fetch(f.url);
          const blob = await res.blob();
          folder.file(f.file_name, blob);
        })
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${jobName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
    setZipping(null);
  }

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 py-2">Loading files...</div>
    );
  }

  if (files.length === 0) {
    return <div className="text-sm text-zinc-500">No output files found.</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">Download</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {fileTypes.map((type) => {
          const typeFiles = files.filter((f) => f.file_type === type && f.url);
          if (typeFiles.length === 0) return null;
          const isZipping = zipping === type;
          return (
            <button
              key={type}
              onClick={() => handleDownloadType(type)}
              disabled={zipping !== null}
              className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors text-center disabled:opacity-50 disabled:cursor-wait"
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 1v8.5M3.5 6L7 9.5 10.5 6M2 12h10" />
                </svg>
                {type.toUpperCase()}
              </span>
              <span className="block text-zinc-500 mt-0.5">
                {isZipping ? "Zipping..." : `${typeFiles.length} files`}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={handleDownloadAll}
        disabled={zipping !== null}
        className="cursor-pointer w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {zipping === "all" ? (
          "Zipping all files..."
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1v10M4 7l4 4 4-4M2 14h12" />
            </svg>
            Download All ({files.filter((f) => f.url).length} files)
          </span>
        )}
      </button>
    </div>
  );
}
