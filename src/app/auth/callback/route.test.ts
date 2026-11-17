// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), verify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession: mocks.exchange, verifyOtp: mocks.verify } })) }));
import { GET } from "./route";

describe("authentication callback redirect boundary", () => {
  beforeEach(() => { mocks.exchange.mockReset().mockResolvedValue({ error: null }); mocks.verify.mockReset().mockResolvedValue({ error: null }); });
  it("allows the explicit password recovery destination", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?code=valid&next=/reset-password"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
  });
  it("does not accept an arbitrary external redirect", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?code=valid&next=https://attacker.test"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
  it("routes cross-device recovery token hashes to the password form", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?token_hash=valid&type=recovery"));
    expect(mocks.verify).toHaveBeenCalledWith({ token_hash: "valid", type: "recovery" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
  });
  it("reports failed verification at login", async () => {
    mocks.exchange.mockResolvedValue({ error: { message: "expired" } });
    const response = await GET(new NextRequest("http://localhost:3000/auth/callback?code=expired"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation");
  });
});
