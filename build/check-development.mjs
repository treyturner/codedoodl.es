import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';

async function reservePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

function request(port, path, host) {
  return new Promise((resolve, reject) => {
    get({ hostname: '127.0.0.1', port, path, headers: { Host: host, Accept: 'text/html' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
      response.on('error', reject);
    }).on('error', reject);
  });
}

export async function checkDevelopment(root, work, gulp) {
  for (const path of ['app', 'config', 'doodles']) {
    await cp(join(root, path), join(work, path), { recursive: true });
  }
  const appReservation = await reservePort();
  const devReservation = await reservePort();
  const appPort = appReservation.address().port;
  const devPort = devReservation.address().port;
  await Promise.all([appReservation, devReservation].map(server => new Promise(resolve => server.close(resolve))));
  const archive = join(work, 'dev-archive');
  await mkdir(join(archive, 'author/sketch'), { recursive: true });
  const sketch = '<!doctype html><html><body><canvas></canvas><script src="main.js"></script></body></html>';
  await writeFile(join(archive, 'master_manifest.json'), gzipSync('{"doodles":[]}'));
  await writeFile(join(archive, 'author/sketch/index.html'), gzipSync(sketch));
  await writeFile(join(archive, 'author/sketch/main.js'), gzipSync('window.sketchLoaded = true;'));
  await writeFile(join(archive, 'author/sketch/thumb.mp4'), '0123456789');
  const env = { ...process.env, BIND_PORT: String(appPort), DEV_PORT: String(devPort), DOODLES_ARCHIVE: archive };
  delete env.DOODLES_URL;
  delete env.BASE_URL;
  delete env.DEV_PASSWORD;
  const child = spawn(process.execPath, [gulp, 'dev'], { cwd: work, env });
  let log = '';
  child.stdout.on('data', bytes => { log += bytes; });
  child.stderr.on('data', bytes => { log += bytes; });
  const host = 'forwarded.example.test:52293';
  try {
    const deadline = Date.now() + 45000;
    while (!log.includes('express is listening on') || !log.includes('Watching project sources')) {
      assert.equal(child.exitCode, null, log);
      assert.ok(Date.now() < deadline, `Development startup timed out\n${log}`);
      await delay(100);
    }
    for (const path of ['/', '/login']) {
      const response = await request(devPort, path, host);
      assert.equal(response.status, 200, log);
      const assets = [...response.body.matchAll(/(?:href|src)="([^" ]+\.(?:css|js))"/g)].map(match => new URL(match[1], `http://${host}`));
      assert.ok(assets.length > 0, 'Rendered page includes assets');
      for (const asset of assets) {
        assert.equal(asset.host, host, 'Assets must use the forwarded host and port');
        const resource = await fetch(`http://127.0.0.1:${devPort}${asset.pathname}`);
        assert.equal(resource.status, 200, asset.href);
        assert.ok((await resource.text()).length > 0, 'Asset decodes successfully');
      }
      assert.ok(!response.body.includes(`127.0.0.1:${appPort}`), 'No upstream URLs leak into the page');
      if (path === '/') assert.ok(response.body.includes(`"//${host}/__doodles"`), 'Artwork uses the forwarded origin');
    }
    const connector = await fetch(`http://127.0.0.1:${devPort}/browser-sync/browser-sync-client.js`);
    assert.equal(connector.status, 200);
    assert.match(await connector.text(), /socketUrl = '\/browser-sync';/, 'Live reload connects to the browser origin');
    console.log('PASS: development pages, assets and live-reload configuration support forwarded ports');
    const artwork = await fetch(`http://127.0.0.1:${devPort}/__doodles/author/sketch/index.html`, { headers: { Accept: 'text/html' } });
    assert.equal(artwork.status, 200);
    assert.equal(artwork.headers.get('content-encoding'), 'gzip');
    assert.match(artwork.headers.get('content-type'), /text\/html/);
    assert.equal(await artwork.text(), sketch, 'Archive HTML decodes without BrowserSync injection');
    const script = await fetch(`http://127.0.0.1:${devPort}/__doodles/author/sketch/main.js`);
    assert.equal(await script.text(), 'window.sketchLoaded = true;');
    const media = await fetch(`http://127.0.0.1:${devPort}/__doodles/author/sketch/thumb.mp4`, { headers: { Range: 'bytes=2-5' } });
    assert.equal(media.status, 206);
    assert.equal(await media.text(), '2345');
    const missing = await fetch(`http://127.0.0.1:${devPort}/__doodles/author/sketch/missing.js`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('content-encoding'), null);
    assert.equal(await missing.text(), 'Artwork file not found');
    console.log('PASS: local artwork retains gzip, MIME types, media ranges and plain 404s');
    const route = join(work, 'app/health/routes.coffee');
    const originalRoute = await readFile(route, 'utf8');
    await writeFile(route, originalRoute.replace("send 'OK'", "send 'compiled-server-watch-probe'"));
    const rebuildDeadline = Date.now() + 45000;
    let rebuilt = false;
    while (Date.now() < rebuildDeadline) {
      assert.equal(child.exitCode, null, log);
      try {
        const response = await fetch(`http://127.0.0.1:${devPort}/health`, { signal: AbortSignal.timeout(1000) });
        if (await response.text() === 'compiled-server-watch-probe') { rebuilt = true; break; }
      } catch { /* The compiled server restarts after a successful rebuild. */ }
      await delay(100);
    }
    assert.ok(rebuilt, `Server source edit did not reach the running app\n${log}`);
    assert.ok(!log.includes('EADDRINUSE'), log);
    console.log('PASS: server edits compile, restart cleanly and serve the new code through BrowserSync');
  } finally {
    if (child.exitCode === null) {
      const deadline = setTimeout(() => child.kill('SIGKILL'), 8000);
      child.kill('SIGTERM');
      await once(child, 'exit');
      clearTimeout(deadline);
    }
  }
}
