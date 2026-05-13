import { db } from './db.js';

const clinics = [
  ['clinic_promis_hay_farm', 'PROMIS Hay Farm', 'PROMIS Hay Farm <signing@docuseal.ink>'],
  ['clinic_promis_london', 'PROMIS London', 'PROMIS London <signing@docuseal.ink>'],
  ['clinic_cardinal', 'Cardinal Clinic', 'Cardinal Clinic <signing@docuseal.ink>']
] as const;

const upsert = db.prepare(`
  INSERT INTO clinics (id, name, email_from)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    email_from = excluded.email_from
`);

for (const clinic of clinics) {
  upsert.run(...clinic);
}

console.log(`Seeded ${clinics.length} clinics`);
