/**
 * PDFs made on the phone (pdf-lib, no server): situation packs as one file,
 * and print-ready sheets with cards at their true size (85.6 × 54 mm) so the
 * photocopy shop prints them right first time.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

const MM = 72 / 25.4;
export const A4 = { width: 210 * MM, height: 297 * MM };
export const CARD = { width: 85.6 * MM, height: 54 * MM };
const MARGIN = 14 * MM;
const INK = rgb(0.11, 0.1, 0.09);
const SOFT = rgb(0.4, 0.38, 0.34);
const LINE = rgb(0.8, 0.77, 0.7);

export type PdfSource =
  | { kind: 'image'; bytes: Uint8Array; mime: string }
  | { kind: 'pdf'; bytes: Uint8Array }
  | { kind: 'missing'; reason: string };

export interface PackPdfDoc {
  title: string;
  number?: string;
  sources: PdfSource[];
}

export interface PackPdfInput {
  title: string;
  person: string;
  familyName: string;
  generatedOn: string;
  checklist: { label: string; done: boolean; optional?: boolean }[];
  docs: PackPdfDoc[];
}

const REPLACEMENTS: Record<string, string> = { '₹': 'Rs. ', ' ': ' ', ' ': ' ' };

/** Standard PDF fonts cannot draw every character (Hindi, ₹); replace what they cannot. */
export function safeText(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of Array.from(text)) {
    const replaced = REPLACEMENTS[ch] ?? ch;
    try {
      font.encodeText(replaced);
      out += replaced;
    } catch {
      out += '?';
    }
  }
  return out;
}

async function embedImage(pdf: PDFDocument, source: { bytes: Uint8Array; mime: string }): Promise<PDFImage | null> {
  const mime = source.mime.toLowerCase();
  try {
    if (mime.includes('png')) return await pdf.embedPng(source.bytes);
    if (mime.includes('jpeg') || mime.includes('jpg')) return await pdf.embedJpg(source.bytes);
  } catch {
    return null;
  }
  return null;
}

/** Fits an image inside a box, keeping its shape, centred. */
function contain(img: PDFImage, box: { x: number; y: number; width: number; height: number }) {
  const scale = Math.min(box.width / img.width, box.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

function header(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, sub: string) {
  page.drawText(safeText(bold, title), { x: MARGIN, y: A4.height - MARGIN - 16, size: 16, font: bold, color: INK });
  page.drawText(safeText(font, sub), { x: MARGIN, y: A4.height - MARGIN - 32, size: 10, font, color: SOFT });
}

function notePage(pdf: PDFDocument, font: PDFFont, bold: PDFFont, title: string, line: string) {
  const page = pdf.addPage([A4.width, A4.height]);
  header(page, font, bold, title, line);
  page.drawRectangle({ x: MARGIN, y: A4.height / 2 - 60, width: A4.width - 2 * MARGIN, height: 120, borderColor: LINE, borderWidth: 1 });
  page.drawText(safeText(font, line), { x: MARGIN + 16, y: A4.height / 2 - 4, size: 11, font, color: SOFT });
}

/** One PDF for a moment of need: a checklist page, then each paper, page by page. */
export async function buildPackPdf(input: PackPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.title} - ${input.person}`);
  pdf.setProducer('Almari');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const cover = pdf.addPage([A4.width, A4.height]);
  header(cover, font, bold, `${input.title}: ${input.person}`, `${input.familyName} · made on ${input.generatedOn}`);
  let y = A4.height - MARGIN - 70;
  for (const item of input.checklist) {
    const mark = item.done ? 'Included' : item.optional ? 'Not added (optional)' : 'Missing';
    cover.drawText(safeText(font, item.label), { x: MARGIN, y, size: 11, font, color: INK });
    cover.drawText(safeText(bold, mark), { x: A4.width - MARGIN - 130, y, size: 10, font: bold, color: item.done ? INK : SOFT });
    y -= 22;
  }

  for (const doc of input.docs) {
    const caption = doc.number ? `${doc.title} · ${doc.number}` : doc.title;
    for (const source of doc.sources) {
      if (source.kind === 'pdf') {
        try {
          const other = await PDFDocument.load(source.bytes, { ignoreEncryption: false });
          const pages = await pdf.copyPages(other, other.getPageIndices());
          pages.forEach((p) => pdf.addPage(p));
        } catch {
          notePage(pdf, font, bold, caption, 'This PDF is locked or damaged, so it could not be added. Share it separately.');
        }
        continue;
      }
      if (source.kind === 'missing') {
        notePage(pdf, font, bold, caption, source.reason);
        continue;
      }
      const img = await embedImage(pdf, source);
      if (!img) {
        notePage(pdf, font, bold, caption, 'This photo type cannot go into a PDF here. Share the photo separately.');
        continue;
      }
      const page = pdf.addPage([A4.width, A4.height]);
      header(page, font, bold, caption, input.person);
      const box = { x: MARGIN, y: MARGIN, width: A4.width - 2 * MARGIN, height: A4.height - 2 * MARGIN - 50 };
      page.drawImage(img, contain(img, box));
    }
  }
  return pdf.save();
}

export interface SheetCard {
  title: string;
  front: PdfSource;
  back?: PdfSource;
}

export const CARDS_PER_PAGE = 4;

/** A4 pages with each card's front and back side by side at true size, with a cut line around each. */
export async function buildPrintSheet(cards: SheetCard[], subtitle: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Print-ready sheet');
  pdf.setProducer('Almari');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gap = 6 * MM;
  const left = (A4.width - (CARD.width * 2 + gap)) / 2;

  for (let start = 0; start < cards.length; start += CARDS_PER_PAGE) {
    const page = pdf.addPage([A4.width, A4.height]);
    header(page, font, bold, 'Print-ready sheet', `${subtitle} · print at 100% (actual size), not "fit to page"`);
    let top = A4.height - MARGIN - 52;
    for (const card of cards.slice(start, start + CARDS_PER_PAGE)) {
      page.drawText(safeText(font, card.title), { x: left, y: top - 8, size: 9, font, color: SOFT });
      const y = top - 12 - CARD.height;
      for (const [i, side] of [card.front, card.back].entries()) {
        if (!side) continue;
        const box = { x: left + i * (CARD.width + gap), y, width: CARD.width, height: CARD.height };
        page.drawRectangle({ ...box, borderColor: LINE, borderWidth: 0.6, borderDashArray: [3, 3] });
        if (side.kind === 'image') {
          const img = await embedImage(pdf, side);
          if (img) page.drawImage(img, contain(img, box));
          else page.drawText('Photo type not supported', { x: box.x + 10, y: box.y + box.height / 2, size: 9, font, color: SOFT });
        } else {
          page.drawText(safeText(font, side.kind === 'missing' ? side.reason : 'PDF: share separately'), { x: box.x + 10, y: box.y + box.height / 2, size: 9, font, color: SOFT });
        }
      }
      top = y - gap;
    }
  }
  return pdf.save();
}

// ---------------------------------------------------------------- the Recovery Kit

export interface KitPdfInput {
  email: string;
  words: string[];
  /** The QR code as a grid of squares (true = dark). */
  qr: { size: number; dark: (x: number, y: number) => boolean };
  createdOn: string;
}

/** One A4 page to print and keep in the almari: the 24 words, the QR code, and what to do with them. */
export async function buildKitPdf(input: KitPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Almari Recovery Kit');
  const page = pdf.addPage([A4.width, A4.height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.09);
  const grey = rgb(0.35, 0.33, 0.3);
  const margin = 18 * MM;
  let y = A4.height - margin;

  page.drawText('Almari Recovery Kit', { x: margin, y: y - 20, size: 22, font: bold, color: ink });
  y -= 34;
  page.drawText(safeText(font, `For ${input.email} · made ${input.createdOn}`), { x: margin, y: y - 11, size: 11, font, color: grey });
  y -= 30;

  const lines = [
    'This page opens your Almari account if you lose every phone. Keep it like a cheque book:',
    'in the almari or a bank locker. Anyone holding it, and signed in as you, can open your papers.',
    'Almari cannot recover your account without it, by design. Making a new kit cancels this one.',
  ];
  for (const line of lines) {
    page.drawText(safeText(font, line), { x: margin, y: y - 10, size: 10.5, font, color: ink });
    y -= 15;
  }
  y -= 14;

  // The 24 words in three columns of eight.
  const colWidth = (A4.width - margin * 2) / 3;
  const rowHeight = 22;
  for (let i = 0; i < input.words.length; i++) {
    const col = Math.floor(i / 8);
    const row = i % 8;
    const x = margin + col * colWidth;
    const top = y - row * rowHeight;
    page.drawRectangle({ x, y: top - rowHeight + 4, width: colWidth - 8, height: rowHeight - 4, borderColor: rgb(0.8, 0.77, 0.7), borderWidth: 0.6 });
    page.drawText(`${i + 1}`.padStart(2, ' '), { x: x + 6, y: top - 13, size: 9, font, color: grey });
    page.drawText(safeText(bold, input.words[i]), { x: x + 24, y: top - 14, size: 12, font: bold, color: ink });
  }
  y -= 8 * rowHeight + 22;

  // The QR code, drawn as squares.
  const qrSize = 62 * MM;
  const quiet = 4;
  const cells = input.qr.size + quiet * 2;
  const cell = qrSize / cells;
  const qx = margin;
  const qy = y - qrSize;
  page.drawRectangle({ x: qx, y: qy, width: qrSize, height: qrSize, color: rgb(1, 1, 1) });
  // Each row's dark run is one bar, overlapping a hair, so printers leave no seams between squares.
  const seam = 0.25;
  for (let r = 0; r < input.qr.size; r++) {
    for (let c = 0; c < input.qr.size; c++) {
      if (!input.qr.dark(c, r)) continue;
      let end = c;
      while (end + 1 < input.qr.size && input.qr.dark(end + 1, r)) end++;
      page.drawRectangle({
        x: qx + (c + quiet) * cell, y: qy + qrSize - (r + quiet + 1) * cell - seam,
        width: (end - c + 1) * cell, height: cell + seam, color: rgb(0, 0, 0),
      });
      c = end;
    }
  }
  const steps = [
    'To use it on a new phone:',
    '1. Open Almari and sign in.',
    '2. Choose "Use your Recovery Kit".',
    '3. Photograph this QR code, or type',
    '    the 24 words in order.',
    '',
    'Not needed when another of your phones,',
    'or a family member, can approve the new one.',
  ];
  let sy = y - 4;
  for (const line of steps) {
    page.drawText(safeText(line.startsWith('To use') ? bold : font, line), { x: qx + qrSize + 10 * MM, y: sy - 11, size: 11, font: line.startsWith('To use') ? bold : font, color: ink });
    sy -= 17;
  }
  return pdf.save();
}
