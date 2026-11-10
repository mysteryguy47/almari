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
