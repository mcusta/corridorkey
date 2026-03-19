import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";

const SUPABASE_FREE_STORAGE = 1 * 1024 * 1024 * 1024; // 1 GB

/**
 * GET /api/storage/usage — return total storage used by current user's jobs.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  // Get all jobs for this user
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, input_storage_path, alpha_storage_path")
    .eq("user_id", user.id);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ used_bytes: 0, used_display: "0 MB", limit_bytes: SUPABASE_FREE_STORAGE, limit_display: "1 GB", percent: 0 });
  }

  let totalBytes = 0;

  // Sum sizes of all files across all job folders
  for (const job of jobs) {
    const subfolders = ["input", "alpha", "output/comp", "output/fg", "output/matte", "output/processed"];
    for (const sub of subfolders) {
      const { data: files } = await admin.storage
        .from(STORAGE_BUCKET)
        .list(`${job.id}/${sub}`, { limit: 1000 });

      if (files) {
        for (const file of files) {
          if (file.metadata?.size) {
            totalBytes += file.metadata.size;
          }
        }
      }
    }
  }

  const percent = Math.round((totalBytes / SUPABASE_FREE_STORAGE) * 100);

  return NextResponse.json({
    used_bytes: totalBytes,
    used_display: formatBytes(totalBytes),
    limit_bytes: SUPABASE_FREE_STORAGE,
    limit_display: "1 GB",
    percent: Math.min(percent, 100),
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
