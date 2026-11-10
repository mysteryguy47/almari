/**
 * Text recognition in the web app, with Tesseract running inside the
 * browser. The photo never leaves the device: only the recognition engine
 * and its English language data are downloaded, once, the first time.
 */
import type { Worker } from 'tesseract.js';

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

let worker: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = import('tesseract.js').then(({ createWorker }) => createWorker('eng'));
    worker.catch(() => {
      worker = null; // let the next attempt retry, e.g. after the network returns
    });
  }
  return worker;
}

export async function recognize(uri: string): Promise<OcrResult | null> {
  const w = await getWorker();
  const { data } = await w.recognize(uri, {}, { text: true, blocks: true });
  const words: OcrWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) words.push({ text: word.text, bbox: word.bbox });
      }
    }
  }
  return { text: data.text, words };
}
