/**
 * Cropping and turning a photo on Android, on the phone (Expo's image
 * manipulator). The result is a new JPEG; the original is left as it was.
 */
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PickedFile } from '@/store/files';

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

/** The photo turned a quarter right, as a new file to keep editing. */
export async function rotateRight(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const ref = await ImageManipulator.manipulate(uri).rotate(90).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Cuts the rectangle (in the photo's own pixels) out as a JPEG named `name`. */
export async function cropTo(uri: string, rect: PixelRect, name: string): Promise<Edited> {
  const r = {
    originX: Math.max(0, Math.round(rect.x)),
    originY: Math.max(0, Math.round(rect.y)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
  const ref = await ImageManipulator.manipulate(uri).crop(r).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return { uri: saved.uri, name, mime: 'image/jpeg', size: new File(saved.uri).size ?? 0, width: saved.width, height: saved.height };
}

/** A made image (masked, resized) as a file to keep in the almari. */
export async function pickedFromResult(result: { uri: string; blob?: Blob }, name: string): Promise<PickedFile> {
  return { uri: result.uri, name, mime: 'image/jpeg', size: new File(result.uri).size ?? 0 };
}
