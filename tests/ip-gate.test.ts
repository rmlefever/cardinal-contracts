import test from 'node:test';
import assert from 'node:assert/strict';
import { ipInCidr, ipAllowed, isInternalIp, isPublicPath, hostFromUrl, requestHost } from '../src/ip-allowlist.js';

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

test('isInternalIp recognises tailnet, RFC1918, loopback; rejects public', () => {
  assert.equal(isInternalIp('100.64.0.90'), true);   // tailnet
  assert.equal(isInternalIp('172.20.0.1'), true);    // docker bridge gateway (direct tailnet appears as this)
  assert.equal(isInternalIp('172.18.0.5'), true);    // docker network
  assert.equal(isInternalIp('192.168.1.5'), true);   // RFC1918
  assert.equal(isInternalIp('127.0.0.1'), true);     // loopback
  assert.equal(isInternalIp('::1'), true);
  assert.equal(isInternalIp('46.62.202.132'), false); // public
  assert.equal(isInternalIp('137.220.91.114'), false);// public
});

test('isPublicPath only exposes the signer flow + uploads + health', () => {
  for (const p of ['/health', '/sign.html', '/sign.js', '/styles.css', '/favicon.ico']) {
    assert.equal(isPublicPath(p), true, `${p} should be public`);
  }
  assert.equal(isPublicPath('/api/sign/abc123'), true);
  assert.equal(isPublicPath('/api/sign/abc123/complete'), true);
  assert.equal(isPublicPath('/uploads/tpl_x.pdf'), true);
  assert.equal(isPublicPath('/sign.html?token=x'), true);             // query stripped
  for (const p of ['/', '/index.html', '/main.js', '/api/clinics', '/api/templates', '/api/contracts', '/storage/ctr_x.signed.pdf']) {
    assert.equal(isPublicPath(p), false, `${p} should be gated`);
  }
});

test('hostFromUrl + requestHost normalise correctly', () => {
  assert.equal(hostFromUrl('https://contracts.docuseal.ink'), 'contracts.docuseal.ink');
  assert.equal(hostFromUrl('http://localhost:4321'), 'localhost');
  assert.equal(hostFromUrl('not a url'), '');
  assert.equal(requestHost('contracts.docuseal.ink'), 'contracts.docuseal.ink');
  assert.equal(requestHost('100.64.0.57:4321'), '100.64.0.57');
  assert.equal(requestHost(undefined), '');
});
