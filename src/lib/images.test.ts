import { describe, expect, it } from "vitest";
import { compressImage, MAX_IMAGE_BYTES, validateImage, validateImageContent } from "./images";

describe("photo validation", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts supported %s files", (type) => {
    expect(validateImage({ type, size: 1024 })).toBeNull();
  });

  it("rejects unsupported and misleading MIME types", () => {
    expect(validateImage({ type: "image/svg+xml", size: 1024 })).toContain("JPEG");
    expect(validateImage({ type: "image/heic", size: 1024 })).toContain("HEIC");
    expect(validateImage({ type: "text/html", size: 1024 })).not.toBeNull();
  });

  it("rejects oversized and empty files with actionable errors", () => {
    expect(validateImage({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).toContain("10 MB");
    expect(validateImage({ type: "image/jpeg", size: 0 })).toContain("empty");
    expect(validateImage({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
  });

  it("fails validation before attempting image decoding or upload", async () => {
    await expect(compressImage({ type: "application/pdf", size: 2048 } as File)).rejects.toThrow("JPEG");
  });

  it("checks actual signature bytes instead of trusting a MIME label", async () => {
    const file = (type: string, bytes: number[]) => ({
      type, size: bytes.length,
      slice: () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }),
    }) as unknown as File;
    await expect(validateImageContent(file("image/jpeg", [0xff, 0xd8, 0xff, 0xe0]))).resolves.toBeNull();
    await expect(validateImageContent(file("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).resolves.toBeNull();
    await expect(validateImageContent(file("image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).resolves.toBeNull();
    await expect(validateImageContent(file("image/jpeg", [0x3c, 0x73, 0x76, 0x67]))).resolves.toContain("doesn't match");
    await expect(validateImageContent(file("image/png", [0xff, 0xd8, 0xff]))).resolves.toContain("doesn't match");
  });

  it("provides a useful recovery message for an unreadable photo", async () => {
    const unreadable = { type: "image/jpeg", size: 1024, slice: () => { throw new Error("NotReadableError"); } } as unknown as File;
    await expect(validateImageContent(unreadable)).resolves.toContain("Try choosing it again");
  });
});
