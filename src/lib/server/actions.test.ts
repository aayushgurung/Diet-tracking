// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodInput, ReactionInput } from "@/lib/types";

const mocks = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, rpc: vi.fn(), cleanup: vi.fn(), refresh: vi.fn(), signOut: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./queries", () => ({ requireUser: vi.fn(async () => mocks.user) }));
vi.mock("./media", () => ({ drainMediaCleanup: mocks.cleanup }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mocks.rpc, auth: { signOut: mocks.signOut } })) }));
import { saveFood, saveReaction, signOut } from "./actions";

const food: FoodInput = { food_name: "Milk", eaten_at: "2026-11-17T01:30:00Z", notes: "", meal_category: null, photo_path: null, components: [] };
const reaction: ReactionInput = { food_entry_id: "33333333-3333-4333-8333-333333333333", symptoms: ["Bloating"], severity: "mild", reaction_at: null, onset_minutes: 30, notes: "An observation" };

describe("trusted journal mutations", () => {
  beforeEach(() => { mocks.rpc.mockReset().mockResolvedValue({ data: "saved-id", error: null }); mocks.cleanup.mockReset(); mocks.refresh.mockReset(); mocks.signOut.mockReset().mockResolvedValue({ error: null }); mocks.redirect.mockReset(); });
  it("rejects invalid food input before any database write", async () => {
    expect((await saveFood({ ...food, food_name: " " })).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects another user's photo path", async () => {
    const result = await saveFood({ ...food, photo_path: "22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg" });
    expect(result.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("saves the eaten time without supplying a creation timestamp", async () => {
    await expect(saveFood(food)).resolves.toEqual({ success: true, data: { id: "saved-id" } });
    expect(mocks.rpc).toHaveBeenCalledWith("save_food_entry", { p_input: food });
    expect(mocks.rpc.mock.calls[0][1].p_input).not.toHaveProperty("created_at");
    expect(mocks.cleanup).toHaveBeenCalledWith(mocks.user.id);
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("preserves a recoverable error without disclosing private database details", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private reaction note" } });
    const result = await saveFood(food);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private reaction note");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("delegates flagging and reaction updates to one atomic RPC", async () => {
    await expect(saveReaction(reaction)).resolves.toEqual({ success: true, data: undefined });
    expect(mocks.rpc).toHaveBeenCalledWith("flag_food_entry", { p_input: reaction });
  });
  it("allows flagging with no optional reaction details", async () => {
    const empty = { ...reaction, symptoms: [], severity: null, onset_minutes: null, notes: "" };
    expect((await saveReaction(empty)).success).toBe(true);
  });
  it("signs out this device before returning to login", async () => {
    await signOut();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
  it("does not report successful sign-out when the auth service fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "offline" } });
    await expect(signOut()).rejects.toThrow("couldn’t sign you out");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
