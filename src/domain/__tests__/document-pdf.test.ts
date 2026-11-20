/** Sharing a whole document as one PDF: every page in order, or a card's two sides on one A4 page. */
import { PDFDocument } from 'pdf-lib';

import { A4, buildDocumentPdf, type PdfSource } from '../pdf';

// A 1×1 white PNG.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
const image: PdfSource = { kind: 'image', bytes: PNG, mime: 'image/png' };

async function pages(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((p) => p.getSize());
}

describe('one PDF for a whole document', () => {
  it('puts each page on its own A4 sheet, PDFs copied in, and notes what could not go in', async () => {
    const attached = await PDFDocument.create();
    attached.addPage([200, 200]);
    attached.addPage([200, 200]);
    const bytes = await buildDocumentPdf({
      title: 'Papa’s Aadhaar',
      sources: [image, image, { kind: 'pdf', bytes: await attached.save() }, { kind: 'missing', reason: 'A Word file. Share it separately.' }],
      layout: 'pages',
    });
    const sizes = await pages(bytes);
    expect(sizes).toHaveLength(5);
    expect(sizes[0]).toEqual({ width: A4.width, height: A4.height });
    expect(sizes[2]).toEqual({ width: 200, height: 200 });
  });

  it('puts front and back together on one page, like a photocopy', async () => {
    expect(await pages(await buildDocumentPdf({ title: 'PAN', sources: [image, image], layout: 'one-page' }))).toHaveLength(1);
    // A PDF among the sides follows on its own page.
    const extra = await PDFDocument.create();
    extra.addPage([100, 100]);
    expect(await pages(await buildDocumentPdf({ title: 'DL', sources: [image, image, { kind: 'pdf', bytes: await extra.save() }], layout: 'one-page' }))).toHaveLength(2);
    // Nothing usable: a page that says so, never an empty file.
    expect(await pages(await buildDocumentPdf({ title: 'DL', sources: [{ kind: 'missing', reason: 'gone' }], layout: 'one-page' }))).toHaveLength(1);
  });
});
