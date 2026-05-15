# Cardinal Contracts

Self-hosted contract sending and signing layer for clinics. It provides the Pro-style workflow we wanted: template upload, visual field placement, one-click sending, signer emails, status tracking, signed PDF generation, and audit logs.

## Retention and archive model

DocuSeal treats storage and retention as a core capability: completed submissions remain available in the dashboard, signed files can be downloaded with their audit log, and archiving is a reversible soft-delete step before permanent removal. We mirror that model here.

- Active contracts stay in the main Contracts view with their status and signed PDF link.
- Archiving moves a contract out of the active view, keeps its database record, field values, audit events, and signed PDF, and blocks the signer URL.
- The archived view can restore a contract or permanently remove it. Permanent removal deletes the contract record and its stored signed PDF.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:4321`. Set `ADMIN_TOKEN` in `.env`; API calls can use `Authorization: Bearer <token>`.

## Patient record integration

Create a contract from a patient record with:

```http
POST /api/contracts
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

```json
{
  "templateId": "tpl_xxx",
  "clinicId": "clinic_cardinal",
  "patientRecordId": "PAT-123",
  "patientName": "Example Patient",
  "patientAge": "42",
  "payerName": "Example Payer",
  "payerEmail": "payer@example.com"
}
```

If `RESEND_API_KEY` is configured, the signer receives an email. Without it, the API response includes the signing URL for testing.
