/**
 * Image work on Android: resize to exact pixels and a size limit, through
 * Expo's image manipulator (on the phone, nothing uploaded).
 */
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { bestQuality, coverCrop, fitWithin, type ExportTarget } from '@/domain/form-export';

export interface ExportResult {
  /** A local file:// (Android) or blob: (web) address of the result. */
  uri: string;
  /** Web only: the encoded image, kept so sharing starts straight from the tap. */
  blob?: Blob;
  bytes: number;
  quality: number;
  width: number;
  height: number;
  fits: boolean;
}

export async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  const ref = await ImageManipulator.manipulate(uri).renderAsync();
  return { width: ref.width, height: ref.height };
}

export async function exportForForm(uri: string, target: ExportTarget): Promise<ExportResult> {
  const size = await imageSize(uri);
  const context = ImageManipulator.manipulate(uri);
  let width: number;
  let height: number;
  if (target.width && target.height) {
    const crop = coverCrop(size.width, size.height, target.width, target.height);
    context.crop({ originX: crop.x, originY: crop.y, width: crop.width, height: crop.height });
    width = target.width;
    height = target.height;
  } else {
    ({ width, height } = fitWithin(size.width, size.height));
  }
  context.resize({ width, height });
  const ref = await context.renderAsync();
  const best = await bestQuality(async (quality) => {
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    return { bytes: new File(saved.uri).size ?? 0, output: saved.uri };
  }, target.maxKB * 1024);
  return { uri: best.output, bytes: best.bytes, quality: best.quality, width, height, fits: best.fits };
}

export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** On Android the mask screen flattens the image with a view capture instead (see doc/mask). */
export async function maskImage(_uri: string, _rects: MaskRect[]): Promise<{ uri: string; blob?: Blob; bytes: number }> {
  throw new Error('maskImage runs in the web app; Android uses a view capture');
}
