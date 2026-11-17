import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/setup", origin));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = type === "recovery" || request.nextUrl.searchParams.get("next") === "/reset-password" ? "/reset-password" : "/";
  const client = await createClient();
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, origin));
  } else if (tokenHash && type && ["signup", "email", "recovery"].includes(type)) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) return NextResponse.redirect(new URL(destination, origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", origin));
}
