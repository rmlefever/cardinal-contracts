import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, type TemplateField } from './db.js';

const sourcePdf = process.argv[2] ?? '/Users/robinlefever/Downloads/Cardinal Standard Room Contract - 2026.pdf';
if (!fs.existsSync(sourcePdf)) {
  throw new Error(`PDF not found: ${sourcePdf}`);
}

fs.mkdirSync(config.uploadDir, { recursive: true });
const id = 'tpl_cardinal_standard_room_2026';
const destination = path.join(config.uploadDir, `${id}.pdf`);
fs.copyFileSync(sourcePdf, destination);

const fields: TemplateField[] = [
  { id: 'patient_name', label: 'Patient Name', type: 'text', required: true, source: 'patientName', page: 4, x: 0.30, y: 0.746, w: 0.31, h: 0.026 },
  { id: 'patient_age', label: 'Patient Age', type: 'number', required: true, source: 'patientAge', page: 4, x: 0.72, y: 0.746, w: 0.13, h: 0.026 },
  { id: 'payer_signature', label: 'Payer Signature', type: 'signature', required: true, source: 'manual', page: 4, x: 0.30, y: 0.805, w: 0.38, h: 0.052 },
  { id: 'signatory_name', label: 'Name of Signatory', type: 'text', required: true, source: 'payerName', page: 4, x: 0.30, y: 0.868, w: 0.38, h: 0.026 },
  { id: 'date_of_signing', label: 'Date of Signing', type: 'date', required: true, source: 'manual', page: 5, x: 0.30, y: 0.193, w: 0.28, h: 0.03 }
];

db.prepare(`
  INSERT INTO templates (id, clinic_id, name, pdf_path, fields_json, status)
  VALUES (?, 'clinic_cardinal', 'Cardinal Standard Room Contract - 2026', ?, ?, 'active')
  ON CONFLICT(id) DO UPDATE SET
    pdf_path = excluded.pdf_path,
    fields_json = excluded.fields_json,
    status = 'active',
    updated_at = CURRENT_TIMESTAMP
`).run(id, destination, JSON.stringify(fields));

console.log(`Seeded ${id}`);
