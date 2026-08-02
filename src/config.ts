import path from 'node:path';

export const config = {
  appUrl: process.env.APP_URL ?? 'http://localhost:4321',
  port: Number(process.env.PORT ?? 4321),
  adminToken: process.env.ADMIN_TOKEN ?? 'change-me',
  // CIDRs/IPs permitted to reach the admin UI + admin API (signer routes stay public).
  // Defaults to the Tailscale CGNAT range + loopback; override with ADMIN_ALLOW_CIDR.
  adminAllowCidrs: (process.env.ADMIN_ALLOW_CIDR ?? '100.64.0.0/10,127.0.0.1/8,::1')
    .split(',').map((s) => s.trim()).filter(Boolean),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
  storageDir: path.resolve(process.env.STORAGE_DIR ?? './storage'),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'DocuSeal <signing@docuseal.ink>'
};
