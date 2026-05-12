import { Resend } from 'resend';
import { config } from './config.js';

export async function sendSigningEmail(input: {
  to: string;
  signerName: string;
  patientName: string;
  signingUrl: string;
}) {
  if (!config.resendApiKey) return { sent: false, reason: 'RESEND_API_KEY is not configured' };

  const resend = new Resend(config.resendApiKey);
  await resend.emails.send({
    from: config.emailFrom,
    to: input.to,
    subject: `Contract for ${input.patientName}`,
    html: `
      <p>Dear ${escapeHtml(input.signerName)},</p>
      <p>Please review and sign the contract for ${escapeHtml(input.patientName)}.</p>
      <p><a href="${input.signingUrl}">Open secure signing link</a></p>
      <p>If the button does not work, copy this link into your browser:<br>${input.signingUrl}</p>
    `
  });

  return { sent: true };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char] ?? char);
}
