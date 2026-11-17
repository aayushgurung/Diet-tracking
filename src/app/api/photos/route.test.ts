// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), insert: vi.fn(), upload: vi.fn(), from: vi.fn(), rpc: vi.fn(), remove: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc, storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } })) }));
import { DELETE, POST } from "./route";

function request(file: File, origin = "http://localhost:3000") {
  const body = new FormData(); body.set("file", file);
  return new NextRequest("http://localhost:3000/api/photos", { method: "POST", headers: { origin }, body });
}
describe("private photo upload boundary", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null });
    mocks.insert.mockReset().mockResolvedValue({ error: null }); mocks.upload.mockReset().mockResolvedValue({ error: null });
    mocks.from.mockReset().mockReturnValue({ insert: mocks.insert });
    mocks.rpc.mockReset(); mocks.remove.mockReset().mockResolvedValue({ error: null });
  });
  it("requires an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request(new File(["x"], "x.jpg", { type: "image/jpeg" })))).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects requests from another origin", async () => {
    expect((await POST(request(new File(["x"], "x.jpg", { type: "image/jpeg" }), "https://other.test"))).status).toBe(403);
  });
  it("rejects a MIME-spoofed photograph", async () => {
    const response = await POST(request(new File(["<svg></svg>"], "photo.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("stages cleanup before uploading and returns a user-scoped path", async () => {
    const response = await POST(request(new File([new Uint8Array([255,216,255,224,0,0])], "photo.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.path).toMatch(/^11111111-1111-4111-8111-111111111111\/[0-9a-f-]+\.jpg$/);
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0]);
  });
  it("does not upload when durable staging fails", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "offline" } });
    const response = await POST(request(new File([new Uint8Array([255,216,255])], "photo.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(500);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  const path = "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg";
  function deletionRequest() {
    return new NextRequest("http://localhost:3000/api/photos", { method: "DELETE", headers: { origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
  }
  function deletionDatabase(count: number, job: { id: string } | null) {
    const media = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(async () => ({ data: job, error: null })), delete: vi.fn() };
    media.update.mockReturnValue(media); media.eq.mockReturnValue(media); media.select.mockReturnValue(media); media.delete.mockReturnValue(media);
    mocks.from.mockImplementation((name: string) => name === "food_entries" ? { select: () => ({ eq: async () => ({ count, error: null }) }) } : media);
  }
  it("keeps a photograph referenced by a saved entry", async () => {
    deletionDatabase(1, { id: "job" });
    expect((await DELETE(deletionRequest())).status).toBe(409);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("does not recreate a staged job already adopted by a concurrent save", async () => {
    deletionDatabase(0, null);
    expect((await DELETE(deletionRequest())).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("keeps a photo if the cleanup lease detects it was adopted", async () => {
    deletionDatabase(0, { id: "job" }); mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await DELETE(deletionRequest())).status).toBe(409);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("removes an abandoned upload only after obtaining the cleanup lease", async () => {
    deletionDatabase(0, { id: "job" }); mocks.rpc.mockResolvedValue({ data: path, error: null });
    expect((await DELETE(deletionRequest())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_media_cleanup", { p_id: "job" });
    expect(mocks.remove).toHaveBeenCalledWith([path]);
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
  });
});
