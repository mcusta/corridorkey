import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";

// Helper: verify auth + job ownership
async function verifyJobOwnership(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 } as const;

  const admin = createServiceClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (jobError || !job) return { error: "Job not found", status: 404 } as const;
  if (job.user_id !== user.id) return { error: "Unauthorized", status: 403 } as const;

  return { user, job, admin } as const;
}

// GET /api/jobs/[id] — get single job with its files
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await verifyJobOwnership(id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { job, admin } = result;

  const { data: files, error: filesError } = await admin
    .from("job_files")
    .select("*")
    .eq("job_id", id)
    .order("file_type")
    .order("frame_number", { ascending: true, nullsFirst: false });

  if (filesError) {
    return NextResponse.json({ error: filesError.message }, { status: 500 });
  }

  return NextResponse.json({ ...job, files: files || [] });
}

// PATCH /api/jobs/[id] — rename a job
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await verifyJobOwnership(id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { admin } = result;
  const body = await request.json();
  const { name } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("jobs")
    .update({ name: name.trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/jobs/[id] — delete a job and its files
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await verifyJobOwnership(id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { job, admin } = result;

  // Don't allow deleting jobs that are currently being processed
  if (["preparing", "processing", "uploading"].includes(job.status)) {
    return NextResponse.json(
      { error: "Cannot delete a job that is currently being processed" },
      { status: 400 }
    );
  }

  // Delete all output files from storage
  const { data: files } = await admin
    .from("job_files")
    .select("storage_path")
    .eq("job_id", id);

  if (files && files.length > 0) {
    const paths = files.map((f: { storage_path: string }) => f.storage_path);
    await admin.storage.from(STORAGE_BUCKET).remove(paths);
  }

  // Also remove input/alpha files from storage
  const storagePaths: string[] = [];
  if (job.input_storage_path) storagePaths.push(job.input_storage_path);
  if (job.alpha_storage_path) storagePaths.push(job.alpha_storage_path);
  if (storagePaths.length > 0) {
    await admin.storage.from(STORAGE_BUCKET).remove(storagePaths);
  }

  // Delete job_files rows
  await admin.from("job_files").delete().eq("job_id", id);

  // Delete the job
  const { error } = await admin.from("jobs").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
