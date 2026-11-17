"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./queries";
import { drainMediaCleanup } from "./media";
import { foodInputSchema, reactionInputSchema, triggerInputSchema, profileInputSchema } from "@/lib/schemas";
import type { ActionResult, FoodInput, ReactionInput, TriggerInput, ProfileInput } from "@/lib/types";

function refreshJournal() { revalidatePath("/", "layout"); }
const uuid = z.string().uuid();

export async function saveFood(input: FoodInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = foodInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your food details." };
  const client = await createClient();
  const value = parsed.data;
  if (value.photo_path && (!value.photo_path.startsWith(`${user.id}/`) || value.photo_path.includes(".."))) {
    return { success: false, error: "This photograph doesn’t belong to your journal." };
  }
  const { data, error } = await client.rpc("save_food_entry", { p_input: value });
  if (error || !data) return { success: false, error: "Your food wasn’t saved. Check your connection and try again." };
  await drainMediaCleanup(user.id);
  refreshJournal();
  return { success: true, data: { id: String(data) } };
}

export async function deleteFood(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { success: false, error: "Choose a valid food entry." };
  const client = await createClient();
  const { error } = await client.rpc("delete_food_entry", { p_id: id });
  if (error) return { success: false, error: "Your entry couldn’t be removed. Please try again." };
  await drainMediaCleanup(user.id);
  refreshJournal();
  return { success: true, data: undefined };
}

export async function saveReaction(input: ReactionInput): Promise<ActionResult> {
  await requireUser();
  const parsed = reactionInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your reaction details." };
  const client = await createClient();
  const { error } = await client.rpc("flag_food_entry", { p_input: parsed.data });
  if (error) return { success: false, error: "Your observation wasn’t saved. Please try again." };
  refreshJournal();
  return { success: true, data: undefined };
}

export async function undoFlag(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { success: false, error: "Choose a valid food entry." };
  const client = await createClient();
  const { error, data } = await client.from("food_entries").update({ is_flagged: false }).eq("id", id).eq("user_id", user.id).select("id").single();
  if (error || !data) return { success: false, error: "The flag couldn’t be undone. Please try again." };
  refreshJournal();
  return { success: true, data: undefined };
}

export async function deleteReaction(foodEntryId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(foodEntryId).success) return { success: false, error: "Choose a valid food entry." };
  const client = await createClient();
  const { error } = await client.from("reaction_reports").delete().eq("food_entry_id", foodEntryId).eq("user_id", user.id);
  if (error) return { success: false, error: "Your reaction details couldn’t be removed. Please try again." };
  refreshJournal();
  return { success: true, data: undefined };
}

export async function saveTrigger(input: TriggerInput): Promise<ActionResult> {
  await requireUser();
  const parsed = triggerInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the watchlist details." };
  const client = await createClient();
  const { error } = await client.rpc("save_trigger_food", { p_input: parsed.data });
  if (error) return { success: false, error: "Your watchlist changes weren’t saved. Check for a duplicate food or alias." };
  refreshJournal();
  return { success: true, data: undefined };
}

export async function setTriggerActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return { success: false, error: "Choose a valid watchlist item." };
  const client = await createClient();
  const { error, data } = await client.from("trigger_foods").update({ is_active: active }).eq("id", id).eq("user_id", user.id).select("id").single();
  if (error || !data) return { success: false, error: "Your watchlist couldn’t be updated. Please try again." };
  refreshJournal();
  return { success: true, data: undefined };
}

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your preferences." };
  const client = await createClient();
  const { error } = await client.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { success: false, error: "Your preferences weren’t saved. Please try again." };
  refreshJournal();
  return { success: true, data: undefined };
}

export async function signOut() {
  const client = await createClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("We couldn’t sign you out. Check your connection and try again.");
  redirect("/login");
}
