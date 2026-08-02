import path from 'node:path';

export const config = {
  appUrl: process.env.APP_URL ?? 'http://localhost:4321',
  port: Number(process.env.PORT ?? 4321),
  adminToken: process.env.ADMIN_TOKEN ?? 'change-me',
  // IPs permitted to reach the admin surface VIA THE PUBLIC DOMAIN (escape
  // hatch, e.g. an office IP). Default loopback-only so local dev works; in
  // production the public domain is admin-blocked unless this is set. Direct
  // tailnet access is allowed separately via internal-network checks.
  adminAllowCidrs: (process.env.ADMIN_ALLOW_CIDR ?? '127.0.0.1/8,::1')
    .split(',').map((s) => s.trim()).filter(Boolean),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
  storageDir: path.resolve(process.env.STORAGE_DIR ?? './storage'),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'DocuSeal <signing@docuseal.ink>'
};
