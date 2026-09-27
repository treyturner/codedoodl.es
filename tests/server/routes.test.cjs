const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { createHmac } = require('node:crypto');
const { once } = require('node:events');
const { runInNewContext } = require('node:vm');
const { readFileSync } = require('node:fs');
const Hashids = require('hashids');
process.env.NODE_ENV = 'development';
process.env.DEV_PASSWORD = 'server-test-password';
process.env.GITHUB_SECRET = 'server-test-hook-secret';
process.env.DOODLE_CACHE_TIMEOUT_MS = '60000';
const config = require('../../dist/config/server');
const app = require('../../dist/app/server');
const cache = require('../../dist/app/utils/getDoodleData');
let server, base;
before(async () => {
  await cache.initialize();
  server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  cache.close();
  if (server) { const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed; }
  require('../../dist/app/utils/logger').end();
});

test('Hashids 2 encodes and decodes every original ID with the original salt/alphabet', () => {
  const hashids = new Hashids(config.shortlinks.SALT, 3, config.shortlinks.ALPHABET);
  for (const entry of JSON.parse(readFileSync('doodles/master_manifest_DEV.json')).doodles) {
    assert.equal(hashids.encode(entry.index), entry.id);
    assert.deepEqual(hashids.decode(entry.id), [entry.index]);
  }
});

test('sessions parse forms/JSON, preserve auth redirects and reject tampered cookies', async () => {
  const blocked = await fetch(base + '/about', { redirect: 'manual' });
  assert.equal(blocked.status, 302);
  assert.equal(blocked.headers.get('set-cookie'), null, 'Anonymous sessions are not saved');
  const empty = await fetch(base + '/login', { method: 'POST', redirect: 'manual' });
  assert.equal(empty.headers.get('location'), '/login?wrong_pw');
  for (const json of [false, true]) {
    const login = await fetch(base + '/login', { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
      body: json ? JSON.stringify({ pw: 'server-test-password' }) : 'pw=server-test-password' });
    assert.equal(login.status, 302);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal((await fetch(base + '/about', { headers: { Cookie: cookie.split(';')[0] } })).status, 200);
    assert.equal((await fetch(base + '/about', { redirect: 'manual', headers: { Cookie: cookie.split(';')[0] + 'tampered' } })).status, 302);
  }
  const malformed = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(malformed.status, 400);
});

test('trusted HTTPS proxy produces secure session cookies', async () => {
  app.set('trust proxy', 1);
  try {
    const response = await fetch(base + '/login', { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }, body: '{"pw":"server-test-password"}' });
    assert.match(response.headers.get('set-cookie'), /Secure/);
  } finally { app.set('trust proxy', false); }
});

test('root paths outside the shortlink alphabet reach static serving and the 404 handler', async () => {
  const login = await fetch(base + '/login', { method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/json' }, body: '{"pw":"server-test-password"}' });
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  for (const path of ['/no-such-baseline-route', '/unknown', '/missing.png']) {
    assert.equal((await fetch(base + path, { headers })).status, 404, path);
  }
  const icon = await fetch(base + '/apple-touch-icon-144x144-precomposed.png', { headers });
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /image\/png/);
});

test('retired webhook validates parsed JSON and stays disabled for signed master pushes', async () => {
  const unsigned = await fetch(base + '/hooks/push', { method: 'POST' });
  assert.equal(unsigned.status, 401);
  const body = JSON.stringify({ ref: 'refs/heads/master', commits: [] });
  const signature = createHmac('sha1', 'server-test-hook-secret').update(body).digest('hex');
  const signed = await fetch(base + '/hooks/push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature': `sha1=${signature}` }, body });
  assert.equal(signed.status, 200);
  assert.equal(await signed.json(), 'deployer disabled for now... fix it later plzzzz');
});

test('EJS 6 escapes metadata and inline JSON without changing configuration values', async () => {
  const data = require('../../dist/app/utils/getTemplateData')('HOME');
  const special = '</script><script>alert("x")</script> & \u2028\u2029';
  const html = await new Promise((resolve, reject) => app.render('site/index', {
    ...data, page_title: special, config: { ...data.config, GA_CODE: special },
  }, (error, value) => error ? reject(error) : resolve(value)));
  assert.ok(html.includes('&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert'));
  const script = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];
  const context = { window: {}, document: { location: { protocol: 'http:', host: 'example.test' } } };
  runInNewContext(script, context);
  assert.equal(context.window.config.GA_code, special);
});
