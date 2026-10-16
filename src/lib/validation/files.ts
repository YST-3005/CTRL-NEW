export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateImageFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `Unsupported type “${file.type || "unknown"}”. Use JPEG, PNG, WebP, or GIF.`,
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "File is larger than 8 MB. Compress or crop the label photo." };
  }
  if (file.size < 32) {
    return { ok: false, error: "File is empty or unreadable." };
  }
  return { ok: true };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
