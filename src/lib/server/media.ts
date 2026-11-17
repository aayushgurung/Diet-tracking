import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Delete jobs survive partial storage failures and are retried by later mutations. */
export async function drainMediaCleanup(userId: string) {
  const client = await createClient();
  const { data } = await client.from("media_cleanup_jobs").select("id,path").eq("user_id", userId).lte("due_at", new Date().toISOString()).limit(100);
  for (const job of data ?? []) {
    const { data: path, error: claimError } = await client.rpc("claim_media_cleanup", { p_id: job.id });
    if (claimError || !path) continue;
    const { error } = await client.storage.from("food-photos").remove([String(path)]);
    if (!error) await client.from("media_cleanup_jobs").delete().eq("id", job.id).eq("user_id", userId);
  }
}
