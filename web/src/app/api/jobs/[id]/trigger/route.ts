import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST /api/jobs/[id]/trigger — dispatch job to RunPod Serverless
export async function POST(
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

  // Verify ownership and status
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (job.status !== "queued") {
    return NextResponse.json(
      { error: `Job is ${job.status}, not queued` },
      { status: 400 }
    );
  }

  // Call RunPod Serverless endpoint
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;

  if (!endpointId || !apiKey) {
    return NextResponse.json(
      { error: "RunPod not configured" },
      { status: 500 }
    );
  }

  const runpodRes = await fetch(
    `https://api.runpod.ai/v2/${endpointId}/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { job_id: id },
        policy: {
          executionTimeout: 1800000, // 30 min max
        },
      }),
    }
  );

  if (!runpodRes.ok) {
    const text = await runpodRes.text();
    console.error("RunPod error:", runpodRes.status, text);
    return NextResponse.json(
      { error: "Failed to dispatch to GPU" },
      { status: 502 }
    );
  }

  const runpodData = await runpodRes.json();

  return NextResponse.json({
    status: "dispatched",
    runpod_job_id: runpodData.id,
  });
}
