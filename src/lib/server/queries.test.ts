// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configured: true, getUser: vi.fn(), createClient: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ get isSupabaseConfigured() { return mocks.configured; } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { getJournal, requireUser } from "./queries";

describe("authenticated journal guard", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.createClient.mockReset().mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  });
  it("shows explicit setup when Supabase is absent", async () => {
    mocks.configured = false;
    await expect(requireUser()).rejects.toThrow("REDIRECT:/setup");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("redirects a signed-out request", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });
  it("rejects a revoked session even when a user payload is present", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "revoked" } }, error: new Error("revoked") });
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });
  it("uses an auth-server-verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "verified" } }, error: null });
    await expect(requireUser()).resolves.toEqual({ id: "verified" });
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it.each(["object", "array", "missing"])("loads the %s form of a PostgREST one-to-one reaction relation", async (shape) => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "verified" } }, error: null });
    const reaction = { id: "reaction", symptoms: ["Bloating"] };
    function table(data: unknown) {
      const end = vi.fn(async () => ({ data, error: null }));
      const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: end, range: end };
      builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.order.mockReturnValue(builder);
      return builder;
    }
    mocks.from.mockImplementation((name: string) => table(name === "profiles" ? { id: "verified" } : name === "trigger_foods" ? [] : [
      { id: "entry", photo_path: null, components: [], reactions: shape === "object" ? reaction : shape === "array" ? [reaction] : null },
    ]));
    const journal = await getJournal();
    expect(journal.entries[0].reaction).toEqual(shape === "missing" ? null : reaction);
  });
});
