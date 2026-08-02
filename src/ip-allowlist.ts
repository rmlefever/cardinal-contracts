// Admin-surface IP gate. The app must be public so external signers can open
// their signing link, but the admin UI and admin API live on the same origin.
// This hides every non-signer route behind an IP allowlist (the tailnet), so
// the public internet can sign but cannot even see the admin surface.
//
// Intended access model:
//   - Signers (public):  https://contracts.docuseal.ink/sign.html  -> public paths below
//   - Admin / framework: http://100.64.0.57:4321  (tailnet)        -> allowed by CIDR
// Configure via ADMIN_ALLOW_CIDR (comma-separated CIDRs/IPs).

const PUBLIC_EXACT = new Set(['/health', '/sign.html', '/sign.js', '/styles.css', '/favicon.ico']);

/** Routes the unauthenticated signer flow needs. Everything else is admin-gated. */
export function isPublicPath(rawPath: string): boolean {
  const path = rawPath.split('?')[0];
  if (PUBLIC_EXACT.has(path)) return true;
  if (path.startsWith('/api/sign/')) return true; // signer fetches contract data + submits
  if (path.startsWith('/uploads/')) return true;  // signer renders the template PDF
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = [m[1], m[2], m[3], m[4]].map(Number);
  if (parts.some((p) => p > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

/** True if `ip` falls inside `cidr` (IPv4 CIDR, IPv4-mapped IPv6, or exact host match). */
export function ipInCidr(ip: string, cidr: string): boolean {
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const v4 = mapped ? mapped[1] : ip;
  const [net, preflenStr] = cidr.split('/');
  const prefix = preflenStr ? parseInt(preflenStr, 10) : 32;
  const ipInt = ipv4ToInt(v4);
  const netInt = ipv4ToInt(net);
  if (ipInt === null || netInt === null) {
    // Not IPv4 (e.g. ::1): only an exact host match in the allowlist permits it.
    return ip === cidr;
  }
  if (prefix < 0 || prefix > 32 || Number.isNaN(prefix)) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

export function ipAllowed(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}
