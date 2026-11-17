import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

/** Optional scheduled media cleanup. No user content is returned. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (!secret || providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Cleanup is not configured." }, { status: 503 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("media_cleanup_jobs").select("id,path,user_id").lte("due_at", new Date().toISOString()).limit(500);
  if (error) return NextResponse.json({ error: "Cleanup could not start." }, { status: 500 });
  let removed = 0;
  for (const job of data ?? []) {
    const { data: path, error: claimError } = await admin.rpc("claim_media_cleanup", { p_id: job.id });
    if (claimError || !path) continue;
    const { error: removeError } = await admin.storage.from("food-photos").remove([String(path)]);
    if (removeError) continue;
    removed++;
    await admin.from("media_cleanup_jobs").delete().eq("id", job.id);
  }
  return NextResponse.json({ removed }, { headers: { "Cache-Control": "no-store" } });
}
