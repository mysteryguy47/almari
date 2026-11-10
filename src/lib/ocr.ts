/**
 * Text recognition on Android. On-device ML Kit needs the installed app
 * build (it is native code that Expo Go does not include), so in the
 * prototype it reports itself unavailable and the screens say so.
 */
export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

export const OCR_AVAILABLE = false;
export const OCR_UNAVAILABLE_REASON = 'Reading numbers from photos arrives with the installed Android app (Google ML Kit, on the phone). Try it in the web app today.';

export async function recognize(_uri: string): Promise<OcrResult | null> {
  return null;
}
