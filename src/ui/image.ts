/**
 * Shrinks an uploaded image to a small square WebP data URL before it is
 * stored, so a squad of photos stays a few megabytes at most.
 * - `cover` crops to fill the square (faces).
 * - `contain` fits the whole image with transparent edges (logos).
 */
export async function resizeImageFile(file: File, { size = 256, mode = 'cover' }: { size?: number; mode?: 'cover' | 'contain' } = {}): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');

    const scale = mode === 'cover' ? Math.max(size / bitmap.width, size / bitmap.height) : Math.min(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    bitmap.close();
  }
}
