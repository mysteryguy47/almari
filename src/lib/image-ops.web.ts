/**
 * Image work in the web app (the iPhone version): a canvas resizes, masks
 * and re-encodes, all inside the browser.
 */
import { bestQuality, coverCrop, fitWithin, type ExportTarget } from '@/domain/form-export';

export interface ExportResult {
  uri: string;
  /** Kept in memory so sharing can start straight from the tap (Safari requires it). */
  blob?: Blob;
  bytes: number;
  quality: number;
  width: number;
  height: number;
  fits: boolean;
}

export function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be opened'));
    img.src = uri;
  });
}

export async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(uri);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/jpeg', quality),
  );
}

export async function exportForForm(uri: string, target: ExportTarget): Promise<ExportResult> {
  const img = await loadImage(uri);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  if (target.width && target.height) {
    const crop = coverCrop(sw, sh, target.width, target.height);
    canvas.width = target.width;
    canvas.height = target.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, target.width, target.height);
  } else {
    const fit = fitWithin(sw, sh);
    canvas.width = fit.width;
    canvas.height = fit.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, fit.width, fit.height);
  }
  const best = await bestQuality(async (quality) => {
    const blob = await toBlob(canvas, quality);
    return { bytes: blob.size, output: blob };
  }, target.maxKB * 1024);
  return { uri: URL.createObjectURL(best.output), blob: best.output, bytes: best.bytes, quality: best.quality, width: canvas.width, height: canvas.height, fits: best.fits };
}

export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Paints solid black over the rectangles (in the image's own pixels) and returns a flattened JPEG. */
export async function maskImage(uri: string, rects: MaskRect[]): Promise<{ uri: string; blob?: Blob; bytes: number }> {
  const img = await loadImage(uri);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000000';
  for (const r of rects) ctx.fillRect(r.x, r.y, r.width, r.height);
  const blob = await toBlob(canvas, 0.92);
  return { uri: URL.createObjectURL(blob), blob, bytes: blob.size };
}
