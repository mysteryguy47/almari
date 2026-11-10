/** Reads a QR code from a photo, in the browser. The photo never leaves the device. */
import jsQR from 'jsqr';

import { loadImage } from './image-ops.web';

export const QR_READ_AVAILABLE = true;

export async function readQrFromImage(uri: string): Promise<string | null> {
  const img = await loadImage(uri);
  // Try the photo at a few sizes: large photos are slow, small QR codes need detail.
  for (const max of [1600, 1000, 2400]) {
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
    if (found?.data) return found.data;
  }
  return null;
}
