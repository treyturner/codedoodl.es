const { test } = require('node:test');
const assert = require('node:assert/strict');

test('image policy rejects new, fixed, changed and expired high findings', async () => {
  const { checkImage } = await import('../../scripts/image-policy.mjs');
  const finding = { VulnerabilityID: 'CVE-TEST', PkgName: 'example', InstalledVersion: '1', Severity: 'HIGH' };
  const report = value => ({ Metadata: { OS: { Family: 'debian' } }, Results: [{ Class: 'os-pkgs', Type: 'debian', Vulnerabilities: [value] }] });
  const exceptions = [{ id: 'CVE-TEST', type: 'debian', severity: 'HIGH', packages: ['example'], versions: ['1'], reason: 'specific exposure', owner: 'maintainer', expires: '2030-01-01' }];
  const now = new Date('2026-09-27');
  assert.equal(checkImage(report(finding), exceptions, now).accepted.length, 1);
  for (const changed of [{ VulnerabilityID: 'CVE-NEW' }, { FixedVersion: '2' }, { InstalledVersion: '2' }, { PkgName: 'different' }, { Severity: 'CRITICAL' }]) {
    assert.equal(checkImage(report({ ...finding, ...changed }), exceptions, now).failures.length, 1);
  }
  assert.equal(checkImage(report(finding), exceptions, new Date('2031-01-01')).failures.length, 1);
  assert.throws(() => checkImage({}, exceptions, now), /Missing OS/);
});

test('the browser bundle does not include the excepted cryptographic shims', async () => {
  const browserify = require('browserify');
  const { resolve } = require('node:path');
  const bundle = browserify(resolve(__dirname, '../../project/coffee/Main.coffee'), { extensions: ['.coffee'] }).transform('coffeeify');
  const found = [];
  bundle.on('dep', dependency => { if (/elliptic|crypto-browserify|browserify-sign|create-ecdh/.test(dependency.file)) found.push(dependency.file); });
  await new Promise((resolve, reject) => bundle.bundle(error => error ? reject(error) : resolve()));
  assert.deepEqual(found, []);
});
