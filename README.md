# Cardinal Contracts

Self-hosted contract sending and signing layer for clinics. It provides the Pro-style workflow we wanted: template upload, visual field placement, one-click sending, signer emails, status tracking, signed PDF generation, and audit logs.

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
