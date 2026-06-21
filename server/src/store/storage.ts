import { randomUUID } from "node:crypto";
import { bucket } from "./firestore.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extForMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? "bin";
}

export function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const found = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext);
  return found ? found[0] : "image/jpeg";
}

export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  prefix = "images",
): Promise<string> {
  const path = `${prefix}/${Date.now()}-${randomUUID()}.${extForMime(mimeType)}`;
  await bucket().file(path).save(buffer, {
    contentType: mimeType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return path;
}

export async function downloadImage(path: string): Promise<Buffer> {
  const [buf] = await bucket().file(path).download();
  return buf;
}

/** A long-lived signed read URL the client can render directly. */
export async function getSignedUrl(path: string): Promise<string> {
  const [url] = await bucket()
    .file(path)
    .getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  return url;
}
