/**
 * Downscale and re-encode an image in the browser, before it is uploaded.
 *
 * Phones shoot 4000px JPEGs. On the 3G that most of this site's traffic runs
 * on, sending one unmodified is the difference between an upload that finishes
 * and one that times out — and, for a banner or a prize card, between a page
 * that paints and one that hangs on its first image.
 *
 * Client-side only: it needs a canvas.
 */
export async function shrinkImage(
  file: File,
  { maxEdge = 1600, quality = 0.85 } = {},
): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("encode failed");
  return { blob, w, h };
}
