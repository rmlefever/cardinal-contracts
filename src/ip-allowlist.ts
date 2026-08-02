// Admin-surface access gate.
//
// The app is public so external signers can open their signing link, but the
// admin UI/API must not be reachable from the public internet. Client IP alone
// can't make this decision: Docker port-mapping makes direct tailnet clients
// appear as the bridge gateway (172.x), in the same private range the reverse
// proxy (Traefik) connects from. So the gate keys off the Host header, which
// Traefik routes on, with a private-IP backstop for defense in depth.
//
// Access model:
//   - Signers (anywhere): public paths below are always open.
//   - Public domain (Host = APP_URL's host): admin blocked, unless the source IP
//     is in ADMIN_ALLOW_CIDR (e.g. an office IP). Default empty => blocked.
//   - Direct access (Host != public domain, e.g. http://100.64.0.57:4321 over
//     the tailnet): admin allowed when the source IP is internal.

const PUBLIC_EXACT = new Set(['/health', '/sign.html', '/sign.js', '/styles.css', '/favicon.ico']);

/** Routes the unauthenticated signer flow needs. Everything else is admin-gated. */
export function isPublicPath(rawPath: string): boolean {
  const path = rawPath.split('?')[0];
  if (PUBLIC_EXACT.has(path)) return true;
  if (path.startsWith('/api/sign/')) return true; // signer fetches contract data + submits
  if (path.startsWith('/uploads/')) return true;  // signer renders the template PDF
  return false;
}

/** Hostname portion of a URL (lower-cased), e.g. "contracts.docuseal.ink". */
export function hostFromUrl(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/** Normalised Host header value with any :port stripped. */
export function requestHost(headerHost: string | undefined): string {
  return String(headerHost ?? '').split(':')[0].toLowerCase();
}

// Internal networks: the tailnet (Tailscale CGNAT 100.64/10), RFC1918, loopback.
// Direct admin access (bypassing the public proxy) must originate from these.
const INTERNAL_RANGES = ['100.64.0.0/10', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.1/8', '::1'];

export function isInternalIp(ip: string): boolean {
  return ipAllowed(ip, INTERNAL_RANGES);
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
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

export function ipAllowed(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}
