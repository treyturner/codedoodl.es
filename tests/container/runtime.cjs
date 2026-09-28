// Compatible with both the legacy Node 10 image and the modern compiled image.
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const [name, port, previewPort, source, commandJSON] = process.argv.slice(2);
const requests = [];
const master = kind => ({ doodles: [{ id: 'test', index: 1, slug: 'test/' + kind }] });
const fixture = http.createServer((req, res) => {
  requests.push(req.url);
  let body;
  if (req.url === '/master_manifest.json') body = master('production');
  else if (req.url === '/master_manifest_DEV.json') body = master('development');
  else if (/^\/test\/(production|development)\/manifest.json$/.test(req.url)) {
    body = { name: 'Container fixture', author: { name: 'Test', github: 'test' }, tags: [] };
  } else { res.writeHead(404); res.end('Unknown fixture'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
  res.end(zlib.gzipSync(JSON.stringify(body)));
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        try {
          const bytes = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers,
            body: res.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(bytes) : bytes });
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.setTimeout(1000, () => req.destroy(new Error('HTTP probe timed out')));
    req.end(body);
  });
}

async function checkPageAssets(origin, page) {
  const response = await request(origin + page);
  assert.strictEqual(response.status, 200, page);
  const html = response.body.toString();
  const cssURL = (html.match(/href="([^"]*\/holding\/css\/[^" ]+\.css)"/) || [])[1];
  assert.ok(cssURL, 'Password page must reference its built stylesheet');
  const css = await request(cssURL);
  assert.strictEqual(css.status, 200, cssURL);
  assert.ok(/text\/css/.test(css.headers['content-type']), 'Stylesheet MIME type');
  assert.strictEqual(css.headers['content-encoding'], 'gzip');
  assert.ok(css.body.toString().includes('@font-face'), 'Decodable stylesheet with font rules');
  const font = await request(origin + '/holding/static/fonts/Monosten-A-webfont.woff2');
  assert.strictEqual(font.status, 200);
  assert.strictEqual(font.body.slice(0, 4).toString(), 'wOF2');
  const svgFont = await request(origin + '/holding/static/fonts/Monosten-A-webfont.svg');
  assert.strictEqual(svgFont.status, 200);
  assert.ok(svgFont.body.toString().includes('<svg'), 'Plain SVG font must not be labelled as gzip');
  const iconURL = (html.match(/id="favicon"[^>]*href="([^"]+)"/) || [])[1];
  const icon = await request(iconURL);
  assert.strictEqual(icon.status, 200);
  assert.strictEqual(icon.body.slice(1, 4).toString(), 'PNG');
}

async function run() {
  let child, exited;
  const deadline = setTimeout(() => { console.error('Container check timed out'); process.exit(1); }, 20000);
  try {
    await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
    // Supply only deployment origins. Keep all image defaults and port settings.
    process.env.DOODLES_URL = 'http://127.0.0.1:' + fixture.address().port;
    const origin = process.env.BASE_URL = 'http://127.0.0.1:' + port;
    const root = process.cwd();
    const compiled = fs.existsSync(path.join(root, 'dist/config/server.js'));
    if (!compiled) require(path.join(root, 'node_modules/coffee-script/register'));
    const config = require(path.join(compiled ? path.join(root, 'dist') : root, 'config/server'));
    assert.strictEqual(config.PRODUCTION, true, 'Image must default to production mode');
    assert.strictEqual(config.DOODLE_DATA_SOURCE, source, 'Image archive selection');
    assert.strictEqual(Number(config.express_preview.port), Number(previewPort), 'Preview port precedence');

    // Launch exactly the image's ENTRYPOINT + CMD, including its real launcher.
    const image = JSON.parse(commandJSON);
    const command = (image.entrypoint || []).concat(image.cmd || []);
    child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
    exited = new Promise(resolve => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
      child.once('error', error => resolve({ error: error.message }));
    });
    let data;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const response = await request(origin + '/api/doodles');
        if (response.status === 200) data = JSON.parse(response.body.toString());
      } catch (error) { if (error.code !== 'ECONNREFUSED') throw error; }
      if (data && data.doodles && data.doodles.length) break;
      await delay(50);
    }
    assert.ok(data && data.doodles, 'Real container command must serve the archive');
    assert.deepStrictEqual(data.doodles.map(doodle => doodle.slug), ['test/' + source]);
    const health = await request(origin + '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.toString(), 'OK');

    // Let any accidental cluster workers finish their startup requests.
    await delay(500);
    const nodePids = fs.readdirSync('/proc').filter(pid => {
      try { return /^\d+$/.test(pid) && path.basename(fs.readlinkSync('/proc/' + pid + '/exe')) === 'node'; }
      catch (_) { return false; } // A process may exit while /proc is enumerated.
    });
    assert.strictEqual(nodePids.length, 2, 'Only the test harness and one application Node process may run');
    const expectedMaster = source === 'production' ? '/master_manifest.json' : '/master_manifest_DEV.json';
    assert.deepStrictEqual(requests.slice().sort(), [expectedMaster, '/test/' + source + '/manifest.json'].sort(),
      'Startup must fetch exactly one selected master and one copy of each manifest');

    if (process.env.DEV_PASSWORD) {
      await checkPageAssets(origin, '/');
      await checkPageAssets(origin, '/login');
      const blocked = await request(origin + '/about');
      assert.strictEqual(blocked.status, 302);
      const login = await request(origin + '/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        'pw=' + encodeURIComponent(process.env.DEV_PASSWORD));
      assert.strictEqual(login.status, 302);
      const cookie = login.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
      for (let attempt = 0; attempt < 5; attempt++) {
        assert.strictEqual((await request(origin + '/about', { headers: { Cookie: cookie } })).status, 200,
          'The session must persist across requests');
      }
    } else if (name === 'defaults') {
      const home = (await request(origin + '/')).body.toString();
      const shareURL = (home.match(/property="og:image"[^>]*content="([^"]+)"/) || [])[1];
      assert.ok(shareURL, 'Home page must advertise a social-preview image');
      const share = await request(shareURL);
      assert.strictEqual(share.status, 200, shareURL);
      assert.ok(/image\/jpeg/.test(share.headers['content-type']));
      assert.strictEqual(share.body.slice(0, 3).toString('hex'), 'ffd8ff');
      const cssURL = (home.match(/href="([^"]*\/css\/[^" ]+\.css)"/) || [])[1];
      const css = await request(cssURL);
      assert.strictEqual(css.status, 200);
      assert.strictEqual(css.headers['content-encoding'], 'gzip');
      assert.ok(css.body.toString().includes('@font-face'), 'Main stylesheet remains decodable');
      for (const family of ['A', 'B', 'F']) {
        const font = await request(origin + '/static/fonts/Monosten-' + family + '-webfont.svg', { headers: { 'Accept-Encoding': 'identity' } });
        assert.strictEqual(font.status, 200);
        assert.strictEqual(font.headers['content-encoding'], undefined, 'Plain SVG fonts must not be labelled as gzip');
        assert.ok(font.body.toString().includes('<svg'));
      }
      const missing = await request(origin + '/static/missing-font.svg', { headers: { 'Accept-Encoding': 'identity' } });
      assert.strictEqual(missing.status, 404);
      assert.strictEqual(missing.headers['content-encoding'], undefined, 'Missing assets must not be labelled as gzip');
    }
    child.kill('SIGTERM');
    assert.deepStrictEqual(await exited, { code: 0, signal: null }, 'Real launcher must shut down cleanly on SIGTERM');
    console.log('PASS: ' + name + ' (real startup, single process, HTTP port ' + port + ', remote ' + source + ' archive)');
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (exited) await exited;
    if (fixture.listening) await new Promise(resolve => fixture.close(resolve));
    clearTimeout(deadline);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
