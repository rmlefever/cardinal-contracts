import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH ?? './data/contracts.sqlite';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email_from TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  fields_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id),
  template_id TEXT NOT NULL REFERENCES templates(id),
  patient_record_id TEXT,
  patient_name TEXT NOT NULL,
  patient_age TEXT,
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signing_token TEXT NOT NULL UNIQUE,
  signed_pdf_path TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_values (
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (contract_id, field_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO clinics (id, name, email_from) VALUES
  ('clinic_promis_hay_farm', 'PROMIS Hay Farm', 'PROMIS Hay Farm <signing@docuseal.ink>'),
  ('clinic_promis_london', 'PROMIS London', 'PROMIS London <signing@docuseal.ink>'),
  ('clinic_cardinal', 'Cardinal Clinic', 'Cardinal Clinic <signing@docuseal.ink>');
`);

export type TemplateField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'signature' | 'checkbox';
  required: boolean;
  source?: 'patientName' | 'patientAge' | 'payerName' | 'payerEmail' | 'manual';
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TemplateRecord = {
  id: string;
  clinic_id: string;
  name: string;
  pdf_path: string;
  fields_json: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ClinicRecord = {
  id: string;
  name: string;
  email_from: string | null;
  created_at: string;
};

export type ContractRecord = {
  id: string;
  clinic_id: string;
  template_id: string;
  patient_record_id: string | null;
  patient_name: string;
  patient_age: string | null;
  payer_name: string;
  payer_email: string;
  status: string;
  signing_token: string;
  signed_pdf_path: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function fieldsFor(template: TemplateRecord): TemplateField[] {
  return JSON.parse(template.fields_json) as TemplateField[];
}
