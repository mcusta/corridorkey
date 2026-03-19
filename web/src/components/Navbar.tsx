"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface StorageUsage {
  used_display: string;
  limit_display: string;
  percent: number;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    fetch("/api/storage/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStorage(data))
      .catch(() => {});
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/jobs" className="text-sm font-bold tracking-tight hover:text-zinc-300 transition-colors">
            AI FX Lab
          </Link>
          <Link
            href="/jobs"
            className={`text-sm transition-colors ${
              pathname === "/jobs"
                ? "text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Jobs
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {storage && (
            <div className="flex items-center gap-2" title={`${storage.used_display} / ${storage.limit_display}`}>
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    storage.percent > 80 ? "bg-red-500" : storage.percent > 50 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${storage.percent}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{storage.used_display}</span>
            </div>
          )}
          <Link
            href="/jobs/new"
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
          >
            + New Job
          </Link>
          <button
            onClick={handleSignOut}
            className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
