/**
 * Cropping and turning a photo in the web app: a canvas, inside the browser.
 * The result is a new JPEG; the original is left as it was.
 */
import type { PickedFile } from '@/store/files';

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be opened'));
    img.src = uri;
  });
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edited extends PickedFile {
  width: number;
  height: number;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/jpeg', quality),
  );
}

/** The photo turned a quarter right, as a new image to keep editing. */
export async function rotateRight(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const img = await loadImage(uri);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  const blob = await toBlob(canvas, 0.95);
  return { uri: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
}

/** Cuts the rectangle (in the photo's own pixels) out as a JPEG named `name`. */
export async function cropTo(uri: string, rect: PixelRect, name: string): Promise<Edited> {
  const img = await loadImage(uri);
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.max(1, Math.min(img.naturalWidth - x, Math.round(rect.width)));
  const height = Math.max(1, Math.min(img.naturalHeight - y, Math.round(rect.height)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  const blob = await toBlob(canvas, 0.92);
  return { uri: URL.createObjectURL(blob), blob, name, mime: 'image/jpeg', size: blob.size, width, height };
}

/** A made image (masked, resized) as a file to keep in the almari. */
export async function pickedFromResult(result: { uri: string; blob?: Blob }, name: string): Promise<PickedFile> {
  const blob = result.blob ?? (await (await fetch(result.uri)).blob());
  return { uri: result.uri, blob, name, mime: 'image/jpeg', size: blob.size };
}
