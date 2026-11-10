/**
 * Form-ready export: resize a photo, signature or page to the exact pixels
 * and file size a portal asks for ("200 × 230 px, under 50 KB"). The maths
 * lives here; the platform code only draws and encodes.
 */

export interface ExportTarget {
  id: string;
  label: string;
  /** Exact output size in pixels; omit to keep the image's own size (shrunk if needed). */
  width?: number;
  height?: number;
  maxKB: number;
}

/** Common sizes. Always check the portal's own instructions: these are starting points, not rules. */
export const EXPORT_PRESETS: readonly ExportTarget[] = [
  { id: 'photo-200x230-50', label: 'Photo 200 × 230 px, under 50 KB', width: 200, height: 230, maxKB: 50 },
  { id: 'photo-350x450-100', label: 'Photo 350 × 450 px, under 100 KB', width: 350, height: 450, maxKB: 100 },
  { id: 'sign-140x60-20', label: 'Signature 140 × 60 px, under 20 KB', width: 140, height: 60, maxKB: 20 },
  { id: 'sign-300x80-30', label: 'Signature 300 × 80 px, under 30 KB', width: 300, height: 80, maxKB: 30 },
  { id: 'doc-200', label: 'Document under 200 KB', maxKB: 200 },
  { id: 'doc-500', label: 'Document under 500 KB', maxKB: 500 },
];

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The centred crop of the source that fills the target's shape without stretching. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): CropRect {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const width = Math.round(srcH * dstRatio);
    return { x: Math.round((srcW - width) / 2), y: 0, width, height: srcH };
  }
  const height = Math.round(srcW / dstRatio);
  return { x: 0, y: Math.round((srcH - height) / 2), width: srcW, height };
}

/** For "keep size" targets: shrink very large images so a size limit is reachable with decent quality. */
export function fitWithin(srcW: number, srcH: number, maxSide = 1600): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  return { width: Math.round(srcW * scale), height: Math.round(srcH * scale) };
}

export interface QualityResult<T> {
  quality: number;
  bytes: number;
  output: T;
  fits: boolean;
}

/**
 * The highest JPEG quality whose output fits `maxBytes`, by binary search
 * (seven encodes at most). If even the lowest quality is too big, returns that
 * smallest attempt with fits=false so the caller can say so plainly.
 */
export async function bestQuality<T>(
  encode: (quality: number) => Promise<{ bytes: number; output: T }>,
  maxBytes: number,
  { min = 0.1, max = 0.95, steps = 7 } = {},
): Promise<QualityResult<T>> {
  const top = await encode(max);
  if (top.bytes <= maxBytes) return { quality: max, ...top, fits: true };
  let lo = min;
  let hi = max;
  let best: QualityResult<T> | undefined;
  let smallest: QualityResult<T> | undefined;
  for (let i = 0; i < steps; i++) {
    const q = Math.round(((lo + hi) / 2) * 100) / 100;
    const attempt = await encode(q);
    const result = { quality: q, ...attempt, fits: attempt.bytes <= maxBytes };
    if (!smallest || attempt.bytes < smallest.bytes) smallest = result;
    if (result.fits) {
      best = result;
      lo = q;
    } else {
      hi = q;
    }
  }
  if (best) return best;
  const floor = await encode(min);
  const last = { quality: min, ...floor, fits: floor.bytes <= maxBytes };
  return last.fits || !smallest || last.bytes <= smallest.bytes ? last : smallest;
}

export function exportFileName(base: string, target: ExportTarget, bytes: number): string {
  const safe = base.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'image';
  const size = target.width && target.height ? `-${target.width}x${target.height}` : '';
  return `${safe}${size}-${Math.ceil(bytes / 1024)}KB.jpg`;
}
