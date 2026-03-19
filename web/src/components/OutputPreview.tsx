"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface OutputFile {
  file_name: string;
  file_type: string;
  frame_number: number | null;
  url: string | null;
}

const PLAYBACK_FPS = 24;

export default function OutputPreview({
  jobId,
  isUploading = false,
}: {
  jobId: string;
  isUploading?: boolean;
}) {
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showGallery, setShowGallery] = useState(isUploading);
  const [loadedCount, setLoadedCount] = useState(0);
  const playRef = useRef(false);
  const preloadedUrls = useRef(new Set<string>());

  // Fetch file list
  const fetchFiles = useCallback(() => {
    fetch(`/api/jobs/${jobId}/files`)
      .then((r) => r.json())
      .then((data) => {
        setFiles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jobId]);

  // Initial fetch
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Poll during upload phase
  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(fetchFiles, 3000);
    return () => clearInterval(interval);
  }, [isUploading, fetchFiles]);

  const compFiles = files.filter((f) => f.file_type === "comp" && f.url);
  const selected = selectedIdx !== null ? compFiles[selectedIdx] : null;
  const allLoaded = loadedCount >= compFiles.length && compFiles.length > 0;
  const canPlay = loadedCount >= 1;

  // Auto-show gallery during upload once frames arrive
  useEffect(() => {
    if (isUploading && compFiles.length > 0) setShowGallery(true);
  }, [isUploading, compFiles.length]);

  // Preload comp images incrementally (handles new files from polling)
  useEffect(() => {
    const comps = files.filter((f) => f.file_type === "comp" && f.url);
    comps.forEach((f) => {
      if (!f.url || preloadedUrls.current.has(f.url)) return;
      preloadedUrls.current.add(f.url);
      const img = new Image();
      img.onload = () => setLoadedCount((c) => c + 1);
      img.onerror = () => setLoadedCount((c) => c + 1);
      img.src = f.url;
    });
  }, [files]);

  const goNext = useCallback(() => {
    setSelectedIdx((i) => (i !== null && i < compFiles.length - 1 ? i + 1 : i));
  }, [compFiles.length]);

  const goPrev = useCallback(() => {
    setSelectedIdx((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  // Play/pause ref sync
  useEffect(() => {
    playRef.current = playing;
  }, [playing]);

  // Playback loop
  useEffect(() => {
    if (!playing || selectedIdx === null) return;

    const interval = setInterval(() => {
      if (!playRef.current) return;
      setSelectedIdx((i) => {
        if (i === null) return null;
        return i >= compFiles.length - 1 ? 0 : i + 1;
      });
    }, 1000 / PLAYBACK_FPS);

    return () => clearInterval(interval);
  }, [playing, selectedIdx === null, compFiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIdx === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedIdx(null);
        setPlaying(false);
      }
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setPlaying(false);
        goNext();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setPlaying(false);
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedIdx, goNext, goPrev]);

  function closeLightbox() {
    setSelectedIdx(null);
    setPlaying(false);
  }

  function openAndPlay() {
    setSelectedIdx(0);
    setPlaying(true);
  }

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 py-4">Loading outputs...</div>
    );
  }

  if (compFiles.length === 0) {
    if (isUploading) {
      return (
        <div className="text-sm text-zinc-500 py-4">
          Waiting for comp frames to upload...
        </div>
      );
    }
    return (
      <div className="text-sm text-zinc-500 py-4">No output files yet.</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium text-zinc-400">Preview</h3>
        <button
          onClick={() => setShowGallery((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
          {showGallery ? "Hide Frames" : "View Frames"}
          <span className="text-zinc-500 text-xs">
            {allLoaded ? compFiles.length : `${loadedCount}/${compFiles.length}`}
          </span>
        </button>
        <button
          onClick={openAndPlay}
          disabled={!canPlay}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9.5-5.5L3 1.5z" />
          </svg>
          {canPlay ? `Play${!allLoaded ? ` (${loadedCount}/${compFiles.length})` : ""}` : "Loading..."}
        </button>
      </div>

      {/* Hero preview — first frame shown immediately */}
      {!showGallery && compFiles.length > 0 && (
        <button
          onClick={() => { setSelectedIdx(0); setPlaying(false); }}
          className="relative rounded-lg border border-zinc-800 overflow-hidden hover:border-zinc-500 transition-colors bg-zinc-900 max-w-md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={compFiles[0].url!}
            alt="First frame preview"
            className="w-full h-auto object-contain"
          />
          {isUploading && (
            <div className="absolute bottom-2 right-2 text-xs bg-black/70 text-zinc-300 px-2 py-1 rounded">
              {compFiles.length} frames uploaded...
            </div>
          )}
        </button>
      )}

      {/* Thumbnail gallery — toggled by View Frames */}
      {showGallery && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
          {compFiles.map((f, i) => (
            <button
              key={f.file_name}
              onClick={() => { setSelectedIdx(i); setPlaying(false); }}
              className="aspect-video rounded border border-zinc-800 overflow-hidden hover:border-zinc-500 transition-colors bg-zinc-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url!}
                alt={f.file_name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && selectedIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Prev button */}
          {!playing && selectedIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.url!}
            alt={selected.file_name}
            className="max-w-[90vw] max-h-[85vh] object-contain select-none"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {!playing && selectedIdx < compFiles.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Bottom controls */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 py-4 bg-gradient-to-t from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Play/Pause */}
            <button
              onClick={() => setPlaying((p) => !p)}
              className="p-2 rounded-full bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              {playing ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <rect x="5" y="3" width="3.5" height="14" rx="1" />
                  <rect x="11.5" y="3" width="3.5" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3v14l12-7L5 3z" />
                </svg>
              )}
            </button>

            {/* Scrub slider */}
            <input
              type="range"
              min="0"
              max={compFiles.length - 1}
              value={selectedIdx}
              onChange={(e) => {
                setPlaying(false);
                setSelectedIdx(Number(e.target.value));
              }}
              className="w-48 sm:w-72 md:w-96 accent-zinc-400 cursor-pointer"
            />

            {/* Frame counter */}
            <span className="text-xs text-zinc-400 tabular-nums w-20 text-center">
              {selectedIdx + 1} / {compFiles.length}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          {/* Keyboard hints */}
          <div className="absolute top-4 left-4 text-xs text-zinc-600">
            Space: play/pause &middot; Arrows: step &middot; Esc: close
          </div>
        </div>
      )}
    </div>
  );
}
