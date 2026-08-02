import test from 'node:test';
import assert from 'node:assert/strict';
import { ipInCidr, ipAllowed, isPublicPath } from '../src/ip-allowlist.js';

test('ipInCidr matches IPv4 inside a CIDR', () => {
  assert.equal(ipInCidr('100.64.0.67', '100.64.0.0/10'), true);
  assert.equal(ipInCidr('100.127.255.255', '100.64.0.0/10'), true);   // top of /10
  assert.equal(ipInCidr('100.128.0.0', '100.64.0.0/10'), false);      // just outside
  assert.equal(ipInCidr('46.62.202.132', '100.64.0.0/10'), false);    // public IP
  assert.equal(ipInCidr('100.64.0.67', '100.64.0.67'), true);         // bare host = /32
});

test('ipInCidr handles IPv4-mapped IPv6 and loopback', () => {
  assert.equal(ipInCidr('::ffff:100.64.0.67', '100.64.0.0/10'), true);
  assert.equal(ipInCidr('127.0.0.1', '127.0.0.1/8'), true);
  assert.equal(ipInCidr('::1', '::1'), true);                         // non-IPv4 exact match
  assert.equal(ipInCidr('::1', '100.64.0.0/10'), false);
});

test('ipAllowed true if any CIDR matches', () => {
  const cidrs = ['100.64.0.0/10', '127.0.0.1/8', '::1'];
  assert.equal(ipAllowed('100.64.0.67', cidrs), true);
  assert.equal(ipAllowed('::1', cidrs), true);
  assert.equal(ipAllowed('46.62.202.132', cidrs), false);
});

test('isPublicPath only exposes the signer flow + uploads + health', () => {
  // public
  for (const p of ['/health', '/sign.html', '/sign.js', '/styles.css', '/favicon.ico']) {
    assert.equal(isPublicPath(p), true, `${p} should be public`);
  }
  assert.equal(isPublicPath('/api/sign/abc123'), true);
  assert.equal(isPublicPath('/api/sign/abc123/complete'), true);
  assert.equal(isPublicPath('/uploads/tpl_x.pdf'), true);
  assert.equal(isPublicPath('/sign.html?token=x'), true);             // query stripped
  // gated (admin)
  for (const p of ['/', '/index.html', '/main.js', '/api/clinics', '/api/templates', '/api/contracts', '/storage/ctr_x.signed.pdf']) {
    assert.equal(isPublicPath(p), false, `${p} should be gated`);
  }
});
