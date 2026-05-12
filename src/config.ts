import path from 'node:path';

export const config = {
  appUrl: process.env.APP_URL ?? 'http://localhost:4321',
  port: Number(process.env.PORT ?? 4321),
  adminToken: process.env.ADMIN_TOKEN ?? 'change-me',
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
  storageDir: path.resolve(process.env.STORAGE_DIR ?? './storage'),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Cardinal Clinic <signing@docuseal.ink>'
};
