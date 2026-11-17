import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Account deletion needs the server-only Supabase service role key.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
