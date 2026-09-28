#!/usr/bin/env node
const { stat } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { createInterface } = require('node:readline');
const { once } = require('node:events');
const express = require('express');

async function main() {
  if (!process.argv[2]) throw new Error('Usage: npm run doodle:preview -- doodles/author/name');
  const directory = resolve(process.argv[2]);
  if (!(await stat(join(directory, 'index.html'))).isFile()) throw new Error('The doodle must have an index.html file.');
  const port = Number(process.env.BIND_PORT || process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('BIND_PORT or PORT must be an integer from 0 to 65535.');
  const host = process.env.BIND_ADDRESS || '127.0.0.1';
  const app = express();
  // Use the same signature-aware serving as the app, including gzip and ranges.
  const staticAssets = require('../app/utils/staticAssets');
  app.use((request, response, next) => {
    const url = new URL(request.url, 'http://preview');
    if (url.pathname.endsWith('/')) request.url = `${url.pathname}index.html${url.search}`;
    next();
  });
  app.use(staticAssets(directory));
  const server = app.listen(port, host);
  await once(server, 'listening');
  console.log(`Serving ${directory} at http://${host}:${server.address().port}/`);
  console.log('Type exit or press Ctrl+C to stop. Source files are left unchanged.');
  const reader = createInterface({ input: process.stdin });
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    reader.close();
    process.stdin.destroy();
    server.close();
    server.closeAllConnections();
  };
  reader.on('line', line => { if (line.trim() === 'exit') close(); });
  reader.on('SIGINT', close);
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
