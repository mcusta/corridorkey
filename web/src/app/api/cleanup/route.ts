import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";

const RETENTION_HOURS = 24;

/**
 * POST /api/cleanup — delete completed/failed jobs older than 24 hours.
 * Called by Vercel Cron or manually. Protected by CRON_SECRET.
 */
export async function POST(request: Request) {
  // Verify cron secret (prevents public access)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  // Find expired jobs (completed or failed, older than 24h)
  const { data: expiredJobs, error } = await admin
    .from("jobs")
    .select("id, input_storage_path, alpha_storage_path")
    .in("status", ["completed", "failed"])
    .lt("updated_at", cutoff);

  if (error || !expiredJobs || expiredJobs.length === 0) {
    return NextResponse.json({ deleted: 0, message: error?.message || "No expired jobs" });
  }

  let totalFilesDeleted = 0;

  for (const job of expiredJobs) {
    // Collect output file paths
    const { data: files } = await admin
      .from("job_files")
      .select("storage_path")
      .eq("job_id", job.id);

    const paths: string[] = [];
    if (files) paths.push(...files.map((f: { storage_path: string }) => f.storage_path));
    if (job.input_storage_path) paths.push(job.input_storage_path);
    if (job.alpha_storage_path) paths.push(job.alpha_storage_path);

    // Delete storage files
    if (paths.length > 0) {
      await admin.storage.from(STORAGE_BUCKET).remove(paths);
      totalFilesDeleted += paths.length;
    }

    // Delete DB records
    await admin.from("job_files").delete().eq("job_id", job.id);
    await admin.from("jobs").delete().eq("id", job.id);
  }

  return NextResponse.json({
    deleted: expiredJobs.length,
    filesRemoved: totalFilesDeleted,
  });
}
