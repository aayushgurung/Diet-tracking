import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { FoodComponent, FoodEntry, JournalData, Profile, ReactionReport, TriggerFood } from "@/lib/types";

export const requireUser = cache(async () => {
  if (!isSupabaseConfigured) redirect("/setup");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return data.user;
});

export const getJournal = cache(async (): Promise<JournalData> => {
  const user = await requireUser();
  const client = await createClient();
  const profileResult = await client.from("profiles").select("*").eq("id", user.id).single();
  if (profileResult.error) throw new Error("We couldn’t load your journal. Check the Supabase migration and try again.");
  const triggers: TriggerFood[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from("trigger_foods").select("*, aliases:trigger_food_aliases(*)")
      .eq("user_id", user.id).order("last_flagged_at", { ascending: false }).order("id").range(start, start + 499);
    if (error) throw new Error("We couldn’t load your watchlist. Please try again.");
    triggers.push(...data as TriggerFood[]);
    if (data.length < 500) break;
  }
  // Supabase caps query responses. Page through all journal rows rather than silently
  // hiding older entries from history, exports, or trigger reaction summaries.
  const entries: FoodEntry[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from("food_entries")
      .select("*, components:food_components(*), reactions:reaction_reports(*)")
      .eq("user_id", user.id).order("eaten_at", { ascending: false }).order("id")
      .range(start, start + 499);
    if (error) throw new Error("We couldn’t load your food entries. Please try again.");
    const rows = data as unknown as (Omit<FoodEntry, "reaction"> & { components: FoodComponent[]; reactions: ReactionReport[] | ReactionReport | null })[];
    for (const row of rows) {
      const { reactions, ...entry } = row;
      entries.push({ ...entry, reaction: Array.isArray(reactions) ? reactions[0] ?? null : reactions, photo_url: null });
    }
    if (rows.length < 500) break;
  }
  const paths = entries.flatMap((entry) => entry.photo_path ? [entry.photo_path] : []);
  const signed = new Map<string, string>();
  for (let start = 0; start < paths.length; start += 100) {
    const { data } = await client.storage.from("food-photos").createSignedUrls(paths.slice(start, start + 100), 3600);
    for (const photo of data ?? []) if (photo.path && photo.signedUrl && !photo.error) signed.set(photo.path, photo.signedUrl);
  }
  for (const entry of entries) entry.photo_url = entry.photo_path ? signed.get(entry.photo_path) ?? null : null;
  return { profile: profileResult.data as Profile, entries, triggers };
});
