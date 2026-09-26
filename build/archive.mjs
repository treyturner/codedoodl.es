import express from 'express';
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function developmentArchive(target) {
  // An explicit remote host retains the separate-origin hosting setup.
  if (process.env.DOODLES_URL) return undefined;
  const directory = resolve(process.env.DOODLES_ARCHIVE || '../codedoodl.es-doodles');
  if (!existsSync(join(directory, 'master_manifest.json'))) {
    if (process.env.DOODLES_ARCHIVE) throw new Error(`No artwork master manifest in ${directory}`);
    return undefined;
  }
  const router = express.Router();
  router.use(express.static(directory, {
    setHeaders(response, filename) {
      // Archived HTML/JS/CSS use gzip bytes under their original filenames.
      const descriptor = openSync(filename, 'r');
      try {
        const signature = Buffer.alloc(2);
        readSync(descriptor, signature, 0, 2, 0);
        if (signature[0] === 0x1f && signature[1] === 0x8b) response.setHeader('Content-Encoding', 'gzip');
      } finally { closeSync(descriptor); }
    },
  }));
  router.use((request, response) => {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Artwork file not found');
  });
  console.log(`Serving local artwork from ${directory}`);
  return {
    url: `${target}/__doodles`,
    middleware: { route: '/__doodles', handle: router },
  };
}
