import fs from 'node:fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { TemplateField, TemplateRecord, ContractRecord } from './db.js';

type Values = Record<string, string>;

function dataUrlToBytes(value: string): Uint8Array | null {
  const match = value.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

export async function stampSignedPdf(input: {
  template: TemplateRecord;
  contract: ContractRecord;
  fields: TemplateField[];
  values: Values;
  outputPath: string;
}) {
  const pdfBytes = await fs.readFile(input.template.pdf_path);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of input.fields) {
    const page = pages[field.page - 1];
    if (!page) continue;

    const value = input.values[field.id] ?? '';
    if (!value) continue;

    const { width, height } = page.getSize();
    const x = field.x * width;
    const y = height - field.y * height - field.h * height;
    const w = field.w * width;
    const h = field.h * height;

    if (field.type === 'signature') {
      const imageBytes = dataUrlToBytes(value);
      if (imageBytes) {
        const png = await pdfDoc.embedPng(imageBytes);
        page.drawImage(png, { x, y, width: w, height: h });
      }
      continue;
    }

    if (field.type === 'checkbox') {
      if (value === 'true' || value === 'on') {
        page.drawText('X', { x: x + 3, y: y + 2, size: Math.min(16, h), font, color: rgb(0.05, 0.08, 0.1) });
      }
      continue;
    }

    page.drawText(value, {
      x: x + 3,
      y: y + Math.max(3, h * 0.25),
      size: Math.min(12, h * 0.62),
      font,
      color: rgb(0.05, 0.08, 0.1),
      maxWidth: w - 6
    });
  }

  const signedPage = pdfDoc.addPage([612, 792]);
  signedPage.drawText('Signing Certificate', { x: 72, y: 700, size: 20, font, color: rgb(0.05, 0.08, 0.1) });
  signedPage.drawText(`Contract: ${input.contract.id}`, { x: 72, y: 660, size: 11, font });
  signedPage.drawText(`Patient record: ${input.contract.patient_record_id ?? 'Not supplied'}`, { x: 72, y: 640, size: 11, font });
  signedPage.drawText(`Signer: ${input.contract.payer_name} <${input.contract.payer_email}>`, { x: 72, y: 620, size: 11, font });
  signedPage.drawText(`Completed: ${new Date().toISOString()}`, { x: 72, y: 600, size: 11, font });
  signedPage.drawText('This certificate records the electronic signing event captured by Cardinal Contracts.', {
    x: 72,
    y: 560,
    size: 10,
    font,
    maxWidth: 468
  });

  await fs.mkdir(input.outputPath.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(input.outputPath, await pdfDoc.save());
}
