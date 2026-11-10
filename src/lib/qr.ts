/**
 * QR codes as a plain grid of squares (true = dark), so they draw the same on
 * screen (SVG) and in a printed PDF, with no images involved. Reading a QR
 * from a photo lives in qr-read(.web).ts.
 */
import QRCode from 'qrcode';

export interface QrGrid {
  size: number;
  dark: (x: number, y: number) => boolean;
}

export function qrGrid(text: string): QrGrid {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (x, y) => modules.get(y, x) === 1 };
}
