import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Script } from 'node:vm';
import { raw, decode, json } from '../support/http.mjs';

const expected = JSON.parse(readFileSync(new URL('../fixtures/api.json', import.meta.url)));
const app = 'http://site.test:3000';
const assets = 'http://assets:8080';

test('health, pages, metadata, and not-found routes preserve their contracts', async () => {
  const health = await raw(`${app}/health`);
  expect(health.status).toBe(200);
  expect(decode(health).toString()).toBe('OK');
  for (const path of ['/', '/about', '/contribute', '/login', '/_/dmnsgn/oitnb']) {
    const response = await raw(app + path);
    expect(response.status, path).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    const html = decode(response).toString();
    expect(html).toContain('<title>');
    expect(html).not.toContain('<%=');
    expect(html).not.toMatch(/\{\{ (?:js|css|data)\//);
    if (path !== '/login') expect(html).toContain(`content="${app}${path}"`);
    if (path.includes('/_/')) {
      expect(html).toContain('OITNB');
      expect(html).toContain(`${assets}/dmnsgn/oitnb/thumb.jpg`);
    }
  }
  for (const path of ['/no-such-baseline-route', '/unknown/nested/route', '/ank']) {
    const response = await raw(app + path);
    expect(response.status, path).toBe(404);
    expect(decode(response).toString()).toContain('pageNotFound');
  }
});

test('redirects and all 77 existing shortlinks retain their destinations', async () => {
  for (const path of ['/_', '/_/dmnsgn']) {
    const response = await raw(app + path);
    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('/');
  }
  for (const doodle of expected.doodles) {
    const response = await raw(`${app}/${doodle.id}`);
    expect(response.status, doodle.id).toBe(301);
    expect(response.headers.location, doodle.id).toBe(`/_/${doodle.slug}`);
  }
  for (const [path, destination] of [
    ['/form', 'https://docs.google.com/forms/d/1K66OvKMiKqGjgmYRFUtEA43KZzBzv4KzObM1JtD4cbk/viewform'],
    ['/extension', 'https://chrome.google.com/webstore/detail/codedoodles/hhfnbfhcojlgbojpphigjibpjkccfikh'],
  ]) {
    const response = await raw(app + path);
    expect(response.status).toBe(301);
    expect(response.headers.location).toBe(destination);
  }
  const unknown = await raw(`${app}/_/nobody/absent`);
  expect(unknown.headers.location).toBe('/404');
  expect(unknown.status).toBe(302);
});

test('API data, ordering, contributor deduplication, and CORS match the frozen archive', async () => {
  expect(await json(`${app}/api/doodles`)).toEqual({ doodles: expected.doodles });
  expect(await json(`${app}/api/contributors`)).toEqual({ contributors: expected.contributors });
  const response = await raw(`${app}/api/doodles`, { headers: { Origin: 'https://example.test' } });
  expect(response.headers['access-control-allow-origin']).toBe('*');
});

test('production cache serves repeated requests without refetching manifests', async () => {
  const before = await json(`${assets}/__requests`);
  for (let i = 0; i < 5; i++) expect((await json(`${app}/api/doodles`)).doodles).toEqual(expected.doodles);
  const after = await json(`${assets}/__requests`);
  expect(after['/master_manifest.json']).toBe(before['/master_manifest.json']);
  expect(after['/dmnsgn/oitnb/manifest.json']).toBe(before['/dmnsgn/oitnb/manifest.json']);
});

test('missing remote master falls back to the local master with the same API', async () => {
  expect(await json('http://fallback:3000/api/doodles')).toEqual({ doodles: expected.fallbackDoodles });
  const requests = await json(`${assets}/__requests`);
  expect(requests['/fixtures/master-404/master_manifest.json']).toBeGreaterThan(0);
});

test('preview mode selects the DEV master rather than the production master', async () => {
  expect(await json('http://preview:3000/api/doodles')).toEqual({ doodles: expected.fallbackDoodles });
  expect((await json(`${assets}/__requests`))['/master_manifest_DEV.json']).toBeGreaterThan(0);
});

test('a failed individual manifest connection does not discard the remaining doodles', async () => {
  const remaining = expected.doodles.filter(doodle => doodle.slug !== 'dmnsgn/oitnb');
  expect(await json('http://partial:3000/api/doodles')).toEqual({ doodles: remaining });
  const requests = await json(`${assets}/__requests`);
  expect(requests['/fixtures/connection-reset/dmnsgn/oitnb/manifest.json']).toBeGreaterThan(0);
});

test('password gate, failed login, and successful session preserve access', async ({ playwright }) => {
  const client = await playwright.request.newContext({ baseURL: 'http://auth:3000' });
  try {
    expect(await (await client.get('/')).text()).toContain('coming soon');
    const blocked = await client.get('/about', { maxRedirects: 0 });
    expect(blocked.status()).toBe(302);
    expect(blocked.headers().location).toBe('/');
    const wrong = await client.post('/login', { form: { pw: 'wrong' }, maxRedirects: 0 });
    expect(wrong.headers().location).toBe('/login?wrong_pw');
    expect(await (await client.get('/login?wrong_pw')).text()).toContain('Wrong. Try again');
    const login = await client.post('/login', { form: { pw: 'baseline-password' }, maxRedirects: 0 });
    expect(login.status()).toBe(302);
    expect(login.headers().location).toBe('/');
    expect((await client.storageState()).cookies.some(cookie => cookie.name === 'connect.sid')).toBe(true);
    expect((await client.get('/about')).status()).toBe(200);
    expect(await (await client.get('/')).text()).toContain('creative code sketches');
  } finally { await client.dispose(); }
});

test('revisioned shell assets contain exactly one valid gzip stream and parse', async () => {
  const home = decode(await raw(`${app}/`)).toString();
  const urls = new Set([...home.matchAll(/(?:src|href)="(http:\/\/site\.test:3000\/[^"\s]+\.(?:css|js))"/g)].map(match => match[1]));
  for (const match of home.matchAll(/(?:templates|locales|tracking)\s*:\s*"([^"\s]+)"/g)) urls.add(app + match[1]);
  expect(urls.size).toBe(6);
  for (const url of urls) {
    expect(url).toMatch(/-[a-f0-9]+\.(css|js|xml|json)$/);
    const response = await raw(url);
    expect(response.status, url).toBe(200);
    expect(response.headers['content-encoding'], url).toBe('gzip');
    expect(response.body.subarray(0, 2).toString('hex'), url).toBe('1f8b');
    const body = gunzipSync(response.body);
    expect(body.subarray(0, 2).toString('hex'), `double gzip: ${url}`).not.toBe('1f8b');
    const text = body.toString();
    if (url.endsWith('.js')) expect(() => new Script(text)).not.toThrow();
    if (url.endsWith('.css')) expect(text).toContain('.page-home');
    if (url.endsWith('.json')) expect(() => JSON.parse(text)).not.toThrow();
    if (url.endsWith('.xml')) expect(text).toContain('id="page-doodle"');
  }
});

test('all modern font files and the favicon are present and keep their binary signatures', async () => {
  for (const face of ['A', 'B', 'F']) {
    for (const [ext, signature] of [['woff', 'wOFF'], ['woff2', 'wOF2']]) {
      const response = await raw(`${app}/static/fonts/Monosten-${face}-webfont.${ext}`);
      expect(response.status).toBe(200);
      expect(decode(response).subarray(0, 4).toString()).toBe(signature);
    }
  }
  const favicon = await raw(`${app}/static/img/icons/favicon/favicon_red.png`);
  expect(favicon.status).toBe(200);
  expect(decode(favicon).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('all available archive entrypoints, manifests, and thumbnails are served locally', async () => {
  const master = await json(`${assets}/master_manifest.json`);
  expect(master.doodles).toHaveLength(78);
  for (const doodle of expected.doodles) {
    const manifest = await raw(`${assets}/${doodle.slug}/manifest.json`);
    expect(manifest.status, doodle.slug).toBe(200);
    expect(manifest.headers['content-encoding']).toBe('gzip');
    expect(JSON.parse(decode(manifest)).name).toBe(doodle.name);
    const index = await raw(`${assets}/${doodle.slug}/index.html`);
    expect(index.status, doodle.slug).toBe(200);
    expect(index.headers['content-encoding']).toBe('gzip');
    expect(decode(index).toString()).toMatch(/<(?:html|head|body)\b/i);
    const thumb = await raw(`${assets}/${doodle.slug}/thumb.jpg`);
    expect(thumb.status, doodle.slug).toBe(200);
    // A few archived thumb.jpg files are actually PNGs; browsers decode both.
    const bytes = decode(thumb);
    const image = bytes.subarray(0, 2).toString('hex') === 'ffd8' ||
      bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    expect(image, doodle.slug).toBe(true);
  }
  const missing = await raw(`${assets}/samsy/fury-ribbons/manifest.json`);
  expect(missing.status).toBe(404); // Explicit pre-existing content exception.
  expect(missing.headers['content-encoding']).toBeUndefined();
});

test('KNOWN: uncompressed shell SVG must not be labelled gzip', async () => {
  const response = await raw(`${app}/static/img/ss/ss-icons.svg`);
  expect(response.status).toBe(200);
  test.fail(true, 'ENCODING-SVG: app/server.coffee labels ordinary SVG bytes as gzip.');
  expect(() => decode(response)).not.toThrow();
});

test('KNOWN: missing static JS must return a decodable 404 page', async () => {
  const response = await raw(`${app}/js/missing-baseline.js`);
  expect(response.status).toBe(404);
  test.fail(true, 'ENCODING-404: extension-based gzip header survives HTML 404 rendering.');
  expect(() => decode(response)).not.toThrow();
});
