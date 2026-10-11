// ── Shrink a photo in the browser before upload ────────────
// Phone cameras produce 3–10 MB photos; the server accepts 5 MB.
// Resizing to at most 1600 px on the long side as a JPEG brings a
// typical photo under 500 KB and makes uploads on mobile data fast.
// If anything fails, the original file is returned unchanged.

const MAX_SIDE = 1600;
const QUALITY = 0.8;
const SKIP_BELOW_BYTES = 500 * 1024;

export const compressImage = async (file) => {
  if (!file || !file.type.startsWith('image/') || file.size <= SKIP_BELOW_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
};
