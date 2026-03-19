import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";

// GET /api/jobs/[id]/files — get signed download URLs for job output files
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  // Verify ownership
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("user_id")
    .eq("id", id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get output files
  const { data: files, error: filesError } = await admin
    .from("job_files")
    .select("*")
    .eq("job_id", id)
    .in("file_type", ["matte", "fg", "processed", "comp"])
    .order("file_type")
    .order("frame_number", { ascending: true, nullsFirst: false });

  if (filesError) {
    return NextResponse.json({ error: filesError.message }, { status: 500 });
  }

  if (!files || files.length === 0) {
    return NextResponse.json([]);
  }

  // Generate signed URLs in batches using createSignedUrls (bulk)
  const BATCH_SIZE = 100;
  const paths = files.map((f: { storage_path: string }) => f.storage_path);
  const signedUrlMap = new Map<string, string>();

  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const { data } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(batch, 3600);

    if (data) {
      data.forEach((item: { path: string | null; signedUrl: string }) => {
        if (item.path && item.signedUrl) {
          signedUrlMap.set(item.path, item.signedUrl);
        }
      });
    }
  }

  const signedFiles = files.map(
    (file: {
      storage_path: string;
      file_name: string;
      file_type: string;
      frame_number: number | null;
    }) => ({
      file_name: file.file_name,
      file_type: file.file_type,
      frame_number: file.frame_number,
      url: signedUrlMap.get(file.storage_path) || null,
    })
  );

  return NextResponse.json(signedFiles);
}
