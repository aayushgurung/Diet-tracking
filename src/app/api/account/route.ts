import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const deletionSchema = z.object({ password: z.string().min(1).max(256), confirmation: z.literal("DELETE") });

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Connect Supabase first." }, { status: 503 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "This request must come from your journal." }, { status: 403 });
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user || !user.email) return NextResponse.json({ error: "Sign in before deleting your account." }, { status: 401 });
  let input;
  try { input = deletionSchema.safeParse(await request.json()); }
  catch { return NextResponse.json({ error: "Enter your password and type DELETE to confirm." }, { status: 400 }); }
  if (!input.success) return NextResponse.json({ error: "Enter your password and type DELETE to confirm." }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Account deletion is not configured. Add the server-only SUPABASE_SERVICE_ROLE_KEY and retry, or contact the site owner." }, { status: 503 });
  // A fresh password verification prevents a stolen unattended session from being
  // sufficient for account deletion. Never accept a client-provided user ID.
  const { data: verified, error: passwordError } = await client.auth.signInWithPassword({ email: user.email, password: input.data.password });
  if (passwordError || verified.user?.id !== user.id) return NextResponse.json({ error: "That password wasn’t recognised. Your account has not been deleted." }, { status: 403 });
  const admin = createAdminClient();
  // The storage path policy permits exactly userId/uuid.ext, so this one-level
  // prefix walk includes every owned photo, including unreferenced uploads.
  while (true) {
    const { data: objects, error: listError } = await admin.storage.from("food-photos").list(user.id, { limit: 100 });
    if (listError) return NextResponse.json({ error: "Photographs couldn’t be removed. Your account is still available; please retry." }, { status: 500 });
    if (!objects?.length) break;
    const { error } = await admin.storage.from("food-photos").remove(objects.map((object) => `${user.id}/${object.name}`));
    if (error) return NextResponse.json({ error: "Some photographs couldn’t be removed. Your account is still available; please retry." }, { status: 500 });
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Your account couldn’t be deleted after photo cleanup. Please retry or contact the site owner." }, { status: 500 });
  await client.auth.signOut({ scope: "local" });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
}
