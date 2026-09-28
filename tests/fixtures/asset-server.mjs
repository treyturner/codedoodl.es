import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.env.ARCHIVE_ROOT || '/archive');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};
const requests = {};

createServer(async (req, res) => {
  const original = new URL(req.url, 'http://assets').pathname;
  requests[original] = (requests[original] || 0) + 1;
  if (original === '/health') return res.end('OK');
  if (original === '/__requests') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(requests));
  }
  let pathname = original;
  const fixture = pathname.match(/^\/fixtures\/([^/]+)(\/.*)$/);
  if (fixture) {
    const [, mode, path] = fixture;
    pathname = path;
    const master = /^\/master_manifest(?:_DEV)?\.json$/.test(path);
    if (mode === 'master-404' && master) {
      res.writeHead(404); return res.end('Fixture: master manifest unavailable');
    }
    if (mode === 'connection-reset' && path === '/dmnsgn/oitnb/manifest.json') {
      return req.socket.destroy();
    }
    // Available for later cache/error migration tests without an external server.
    if (mode === 'invalid-json' && master) {
      res.setHeader('Content-Type', 'application/json'); return res.end('{invalid');
    }
    if (mode === 'empty' && master) {
      res.setHeader('Content-Type', 'application/json'); return res.end('{"doodles":[]}');
    }
    if (mode === 'timeout' && master) return; // Client must apply its own timeout.
  }
  try {
    const filename = resolve(root, '.' + decodeURIComponent(pathname));
    if (!filename.startsWith(root + sep)) {
      res.writeHead(403); return res.end('Forbidden');
    }
    if (!(await stat(filename)).isFile()) throw new Error('Not a file');
    let body = await readFile(filename);
    res.setHeader('Content-Type', types[extname(filename).toLowerCase()] || 'application/octet-stream');
    // The archive uses gzip bytes under normal filenames, including manifests.
    const compressed = body[0] === 0x1f && body[1] === 0x8b;
    if (compressed) res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range && !compressed) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
      if (start > end) { res.writeHead(416); return res.end(); }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`);
      body = body.subarray(start, end + 1);
    }
    res.setHeader('Content-Length', body.length);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(8080, '0.0.0.0', () => console.log('Pinned archive server listening on :8080'));
