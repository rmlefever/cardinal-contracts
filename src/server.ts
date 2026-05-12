import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { config } from './config.js';
import { audit } from './audit.js';
import { db, fieldsFor, type ClinicRecord, type ContractRecord, type TemplateRecord, type TemplateField } from './db.js';
import { sendSigningEmail } from './email.js';
import { stampSignedPdf } from './pdf.js';

fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(config.storageDir, { recursive: true });

const app = Fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 });
await app.register(cors, { origin: true, credentials: true });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
await app.register(fastifyStatic, { root: path.resolve('public'), prefix: '/' });
await app.register(fastifyStatic, { root: config.uploadDir, prefix: '/uploads/', decorateReply: false });
await app.register(fastifyStatic, { root: config.storageDir, prefix: '/storage/', decorateReply: false });

function requireAdmin(request: { headers: Record<string, unknown> }) {
  const header = String(request.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== config.adminToken) {
    const error = new Error('Unauthorized') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
}

function publicTemplate(t: TemplateRecord) {
  return { ...t, fields: fieldsFor(t), fields_json: undefined };
}

app.get('/health', async () => ({ ok: true }));

app.get('/api/clinics', async (request) => {
  requireAdmin(request);
  return db.prepare('SELECT * FROM clinics ORDER BY name ASC').all() as ClinicRecord[];
});

app.post('/api/clinics', async (request) => {
  requireAdmin(request);
  const body = z.object({
    name: z.string().min(1),
    emailFrom: z.string().optional()
  }).parse(request.body);
  const id = `clinic_${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${nanoid(5)}`;
  db.prepare('INSERT INTO clinics (id, name, email_from) VALUES (?, ?, ?)').run(id, body.name, body.emailFrom ?? null);
  return db.prepare('SELECT * FROM clinics WHERE id = ?').get(id) as ClinicRecord;
});

app.delete('/api/clinics/:id', async (request) => {
  requireAdmin(request);
  const id = (request.params as { id: string }).id;
  const counts = {
    templates: (db.prepare('SELECT COUNT(*) AS count FROM templates WHERE clinic_id = ?').get(id) as { count: number }).count,
    contracts: (db.prepare('SELECT COUNT(*) AS count FROM contracts WHERE clinic_id = ?').get(id) as { count: number }).count
  };
  if (counts.templates || counts.contracts) {
    throw Object.assign(new Error('Clinic has templates or contracts and cannot be deleted'), { statusCode: 400 });
  }
  db.prepare('DELETE FROM clinics WHERE id = ?').run(id);
  return { ok: true };
});

app.get('/api/templates', async (request) => {
  requireAdmin(request);
  const clinicId = (request.query as { clinicId?: string }).clinicId;
  const rows = clinicId
    ? db.prepare('SELECT * FROM templates WHERE clinic_id = ? ORDER BY created_at DESC').all(clinicId) as TemplateRecord[]
    : db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all() as TemplateRecord[];
  return rows.map(publicTemplate);
});

app.post('/api/templates/upload', async (request) => {
  requireAdmin(request);
  const data = await request.file();
  if (!data) throw new Error('PDF file is required');

  const id = `tpl_${nanoid(10)}`;
  const filename = `${id}.pdf`;
  const pdfPath = path.join(config.uploadDir, filename);
  await fsp.writeFile(pdfPath, await data.toBuffer());

  const formFields = data.fields as Record<string, { value?: unknown } | undefined>;
  db.prepare(`
    INSERT INTO templates (id, clinic_id, name, pdf_path)
    VALUES (?, ?, ?, ?)
  `).run(id, String(formFields.clinicId?.value ?? 'clinic_cardinal'), String(formFields.name?.value ?? data.filename), pdfPath);

  return publicTemplate(db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRecord);
});

const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'date', 'signature', 'checkbox']),
  required: z.boolean().default(true),
  source: z.enum(['patientName', 'patientAge', 'payerName', 'payerEmail', 'manual']).optional(),
  page: z.number().int().positive(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.005).max(1),
  h: z.number().min(0.005).max(1)
});

app.put('/api/templates/:id/fields', async (request) => {
  requireAdmin(request);
  const body = z.object({ fields: z.array(fieldSchema), status: z.enum(['draft', 'active']).default('active') }).parse(request.body);
  db.prepare('UPDATE templates SET fields_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(body.fields), body.status, (request.params as { id: string }).id);
  return publicTemplate(db.prepare('SELECT * FROM templates WHERE id = ?').get((request.params as { id: string }).id) as TemplateRecord);
});

app.get('/api/contracts', async (request) => {
  requireAdmin(request);
  const clinicId = (request.query as { clinicId?: string }).clinicId;
  if (clinicId) {
    return db.prepare('SELECT * FROM contracts WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 200').all(clinicId);
  }
  return db.prepare('SELECT * FROM contracts ORDER BY created_at DESC LIMIT 200').all();
});

const createContractSchema = z.object({
  templateId: z.string(),
  clinicId: z.string().default('clinic_cardinal'),
  patientRecordId: z.string().optional(),
  patientName: z.string().min(1),
  patientAge: z.string().optional(),
  payerName: z.string().min(1),
  payerEmail: z.string().email()
});

app.post('/api/contracts', async (request) => {
  requireAdmin(request);
  const body = createContractSchema.parse(request.body);
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(body.templateId) as TemplateRecord | undefined;
  if (!template) throw Object.assign(new Error('Template not found'), { statusCode: 404 });
  if (template.status !== 'active') throw Object.assign(new Error('Template must be active before it can be sent'), { statusCode: 400 });

  const id = `ctr_${nanoid(12)}`;
  const token = nanoid(32);
  db.prepare(`
    INSERT INTO contracts
      (id, clinic_id, template_id, patient_record_id, patient_name, patient_age, payer_name, payer_email, signing_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.clinicId, body.templateId, body.patientRecordId ?? null, body.patientName, body.patientAge ?? null, body.payerName, body.payerEmail, token);

  const fields = fieldsFor(template);
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.source === 'patientName') values[field.id] = body.patientName;
    if (field.source === 'patientAge') values[field.id] = body.patientAge ?? '';
    if (field.source === 'payerName') values[field.id] = body.payerName;
    if (field.source === 'payerEmail') values[field.id] = body.payerEmail;
  }
  const insertValue = db.prepare('INSERT OR REPLACE INTO contract_values (contract_id, field_id, value) VALUES (?, ?, ?)');
  for (const [fieldId, value] of Object.entries(values)) insertValue.run(id, fieldId, value);

  const signingUrl = `${config.appUrl}/sign.html?token=${token}`;
  const email = await sendSigningEmail({ to: body.payerEmail, signerName: body.payerName, patientName: body.patientName, signingUrl });
  audit({ contractId: id, actor: 'system', eventType: 'contract.created', data: { patientRecordId: body.patientRecordId, email } });
  return { ...(db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as ContractRecord), signingUrl, email };
});

app.get('/api/sign/:token', async (request) => {
  const token = (request.params as { token: string }).token;
  const contract = db.prepare('SELECT * FROM contracts WHERE signing_token = ?').get(token) as ContractRecord | undefined;
  if (!contract) throw Object.assign(new Error('Contract not found'), { statusCode: 404 });
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(contract.template_id) as TemplateRecord;
  const values = db.prepare('SELECT field_id, value FROM contract_values WHERE contract_id = ?').all(contract.id) as { field_id: string; value: string }[];
  audit({ contractId: contract.id, actor: 'signer', eventType: 'contract.opened', ip: request.ip, userAgent: request.headers['user-agent'], data: {} });
  return { contract, template: publicTemplate(template), values: Object.fromEntries(values.map((v) => [v.field_id, v.value])) };
});

app.post('/api/sign/:token/complete', async (request) => {
  const token = (request.params as { token: string }).token;
  const body = z.object({ values: z.record(z.string()) }).parse(request.body);
  const contract = db.prepare('SELECT * FROM contracts WHERE signing_token = ?').get(token) as ContractRecord | undefined;
  if (!contract) throw Object.assign(new Error('Contract not found'), { statusCode: 404 });
  if (contract.status === 'completed') throw Object.assign(new Error('Contract is already completed'), { statusCode: 400 });

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(contract.template_id) as TemplateRecord;
  const fields = fieldsFor(template);
  const missing = fields.filter((field) => field.required && !body.values[field.id]);
  if (missing.length) throw Object.assign(new Error(`Missing required fields: ${missing.map((f) => f.label).join(', ')}`), { statusCode: 400 });

  const insertValue = db.prepare('INSERT OR REPLACE INTO contract_values (contract_id, field_id, value) VALUES (?, ?, ?)');
  for (const [fieldId, value] of Object.entries(body.values)) insertValue.run(contract.id, fieldId, value);

  const signedPdfPath = path.join(config.storageDir, `${contract.id}.signed.pdf`);
  await stampSignedPdf({ template, contract, fields: fields as TemplateField[], values: body.values, outputPath: signedPdfPath });
  db.prepare(`
    UPDATE contracts
    SET status = 'completed', signed_pdf_path = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(signedPdfPath, contract.id);
  audit({ contractId: contract.id, actor: 'signer', eventType: 'contract.completed', ip: request.ip, userAgent: request.headers['user-agent'], data: {} });
  return { ok: true, signedPdfUrl: `/storage/${path.basename(signedPdfPath)}` };
});

app.get('/api/contracts/:id/audit', async (request) => {
  requireAdmin(request);
  return db.prepare('SELECT * FROM audit_events WHERE contract_id = ? ORDER BY created_at ASC').all((request.params as { id: string }).id);
});

app.listen({ port: config.port, host: '0.0.0.0' });
