# Cardinal Contracts Build Plan

## Goal

Build a self-hosted contract platform for five clinics that replaces the missing DocuSeal Pro workflow: upload reusable templates, place fields visually, send from a patient record in one click, email signing links, collect signatures, generate signed PDFs, and retain audit evidence.

## Phases

1. Foundation
   - Standalone Fastify app with SQLite persistence.
   - Clinic, template, contract, field value, and audit-event tables.
   - Admin-token protected API.
   - PDF storage and signed-PDF output storage.

2. Template Builder
   - Upload contract PDFs.
   - Render PDFs in the browser.
   - Add, move, and save fields by page.
   - Support text, number, date, checkbox, and signature fields.
   - Map fields to patient-record inputs such as patient name, age, payer name, and payer email.

3. One-Click Sending
   - API endpoint for patient systems to create a contract from a template.
   - Pre-fill mapped fields.
   - Generate secure signing tokens.
   - Send signing email through Resend when configured.
   - Return signing URL for testing and fallback workflows.

4. Signing Portal
   - Public signing page for the payer.
   - Form fields and signature capture.
   - Required-field validation.
   - Signed PDF generation with field stamping and a signing certificate page.

5. Operations
   - Contract dashboard with pending/completed status.
   - Signed PDF download.
   - Audit log endpoint for each contract.
   - Health endpoint for deployment monitoring.

6. Hardening Next
   - User accounts and roles instead of a single admin token.
   - Per-clinic branding and sender configuration.
   - Webhooks back into patient-record systems.
   - Multi-signer routing and reminders.
   - Immutable audit export and retention policies.
   - Deployment backup/restore automation.

## Current Status

Phases 1-5 are implemented as the first working version. Phase 6 is the remaining production-hardening work before using this as a clinical system of record.
