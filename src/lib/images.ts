export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImage(file: Pick<File, "type" | "size">): string | null {
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPEG, PNG or WebP image. Convert HEIC photos before uploading.";
  }
  if (file.size === 0) return "This image is empty. Choose another photo.";
  if (file.size > MAX_IMAGE_BYTES) return "Choose a photo smaller than 10 MB.";
  return null;
}

/** Check file bytes as well as the browser-provided MIME label. */
export async function validateImageContent(file: File): Promise<string | null> {
  const error = validateImage(file);
  if (error) return error;
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer()); }
  catch { return "We couldn't read that photo. Try choosing it again or use another image."; }
  const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const valid =
    (file.type === "image/jpeg" && startsWith([0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === "image/webp" && startsWith([0x52, 0x49, 0x46, 0x46]) &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
  return valid ? null : "This file doesn't match its image type. Choose another JPEG, PNG or WebP photo.";
}

/** Decode before uploading, limit dimensions, strip metadata and produce JPEG. */
export async function compressImage(file: File): Promise<File> {
  const error = await validateImageContent(file);
  if (error) throw new Error(error);

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("We couldn't read that photo. Try a different image."));
      element.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("This photo has invalid dimensions. Choose another image.");
    }
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser couldn't prepare the photo. Please try another browser.");
    // JPEG has no alpha channel; fill a soft white background for transparent PNGs.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("We couldn't prepare that photo. Please try again.")), "image/jpeg", 0.84);
    });
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("This photo is still too large. Choose a smaller photo.");
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
