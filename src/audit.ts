import { nanoid } from 'nanoid';
import { db } from './db.js';

export function audit(input: {
  contractId?: string;
  actor: string;
  eventType: string;
  ip?: string;
  userAgent?: string;
  data?: unknown;
}) {
  db.prepare(`
    INSERT INTO audit_events (id, contract_id, actor, event_type, ip, user_agent, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `evt_${nanoid(12)}`,
    input.contractId ?? null,
    input.actor,
    input.eventType,
    input.ip ?? null,
    input.userAgent ?? null,
    JSON.stringify(input.data ?? {})
  );
}
