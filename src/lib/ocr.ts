/**
 * Text recognition on Android, with Google ML Kit running on the phone. The
 * photo never leaves the device, and the recognition model ships inside the
 * app, so it works offline. Same result shape as the web's Tesseract version.
 */
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

export const OCR_AVAILABLE = true;
export const OCR_UNAVAILABLE_REASON = '';

/** Reads a local image (a file:// address). Word boxes are in the photo's own pixels, upright. */
export async function recognize(uri: string): Promise<OcrResult | null> {
  const result = await recognizeText(uri);
  const words: OcrWord[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      for (const el of line.elements) {
        words.push({ text: el.text, bbox: { x0: el.frame.left, y0: el.frame.top, x1: el.frame.right, y1: el.frame.bottom } });
      }
    }
  }
  return { text: result.text, words };
}
