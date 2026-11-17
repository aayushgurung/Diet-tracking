import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const MAX_BYTES = 10 * 1024 * 1024;
const pathSchema = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/);

async function authenticated(request: NextRequest) {
  if (!isSupabaseConfigured) return { error: NextResponse.json({ error: "Connect Supabase first." }, { status: 503 }) };
  if (request.headers.get("origin") !== request.nextUrl.origin) return { error: NextResponse.json({ error: "Upload photographs from your journal." }, { status: 403 }) };
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Sign in to manage your photographs." }, { status: 401 }) };
  return { client, user };
}

export async function POST(request: NextRequest) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const { client, user } = auth;
  let file;
  try { file = (await request.formData()).get("file"); }
  catch { return NextResponse.json({ error: "The photograph couldn’t be read. Please choose it again." }, { status: 400 }); }
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) return NextResponse.json({ error: "Choose an image smaller than 10 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = file.type === "image/png" && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  const webp = file.type === "image/webp" && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  if (!jpeg && !png && !webp) return NextResponse.json({ error: "Choose a valid JPEG, PNG or WebP photograph." }, { status: 400 });
  const path = `${user.id}/${crypto.randomUUID()}.${jpeg ? "jpg" : png ? "png" : "webp"}`;
  // Register before upload so a process exit never leaves an untracked object.
  const { error: stagingError } = await client.from("media_cleanup_jobs").insert({ user_id: user.id, path, due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  if (stagingError) return NextResponse.json({ error: "Your photograph couldn’t be prepared. Please try again." }, { status: 500 });
  const { error } = await client.storage.from("food-photos").upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) return NextResponse.json({ error: "Your photograph wasn’t uploaded. Check your connection and try again." }, { status: 500 });
  return NextResponse.json({ path }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const { client, user } = auth;
  let path: string;
  try { path = pathSchema.parse((await request.json() as { path?: unknown }).path); }
  catch { return NextResponse.json({ error: "Choose a valid photograph." }, { status: 400 }); }
  if (!path.startsWith(`${user.id}/`)) return NextResponse.json({ error: "That photograph isn’t in your journal." }, { status: 403 });
  const { count, error: referenceError } = await client.from("food_entries").select("id", { head: true, count: "exact" }).eq("photo_path", path);
  if (referenceError || count) return NextResponse.json({ error: "Remove the photograph from its food entry first." }, { status: 409 });
  const { data: job, error: jobError } = await client.from("media_cleanup_jobs")
    .update({ due_at: new Date().toISOString() }).eq("user_id", user.id).eq("path", path).select("id").single();
  if (jobError || !job) return NextResponse.json({ error: "That photograph is no longer a staged upload." }, { status: 409 });
  const { data: leasedPath, error: claimError } = await client.rpc("claim_media_cleanup", { p_id: job.id });
  if (claimError || !leasedPath) return NextResponse.json({ error: "That photograph is in use or cleanup is already underway." }, { status: 409 });
  const { error } = await client.storage.from("food-photos").remove([String(leasedPath)]);
  if (error) return NextResponse.json({ error: "Cleanup will be retried automatically." }, { status: 500 });
  await client.from("media_cleanup_jobs").delete().eq("user_id", user.id).eq("path", path);
  return NextResponse.json({ success: true });
}
