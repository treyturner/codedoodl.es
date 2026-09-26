const express = require('express');
const { open } = require('node:fs/promises');
const { resolve, sep, extname } = require('node:path');
const { promisify } = require('node:util');
const gunzip = promisify(require('node:zlib').gunzip);

module.exports = function staticAssets(directory) {
  const root = resolve(directory);
  const ordinary = express.static(root);
  return function serve(request, response, next) {
    if (!['GET', 'HEAD'].includes(request.method)) return next();
    async function compressed() {
      const path = decodeURIComponent(request.path);
      const filename = resolve(root, `.${path}`);
      if (!filename.startsWith(root + sep) || path.split('/').some(part => part.startsWith('.'))) return false;
      let file;
      try { file = await open(filename); }
      catch (error) {
        if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return false;
        throw error;
      }
      let bytes, stat;
      try {
        stat = await file.stat();
        if (!stat.isFile()) return false;
        const signature = Buffer.alloc(2);
        await file.read(signature, 0, 2, 0);
        if (signature[0] !== 0x1f || signature[1] !== 0x8b) return false;
        bytes = await file.readFile();
      } finally { await file.close(); }
      response.vary('Accept-Encoding');
      const encoding = request.acceptsEncodings('gzip', 'identity');
      if (!encoding) {
        response.status(406).type('text').send('No acceptable asset encoding');
        return true;
      }
      response.type(extname(filename));
      response.set('Cache-Control', 'public, max-age=0');
      response.set('Last-Modified', stat.mtime.toUTCString());
      response.set('Accept-Ranges', 'none');
      if (encoding === 'gzip') response.set('Content-Encoding', 'gzip');
      else bytes = await gunzip(bytes);
      // Express generates a representation-specific ETag and handles HEAD/304.
      response.send(bytes);
      return true;
    }
    compressed().then(handled => { if (!handled) ordinary(request, response, next); }).catch(error => {
      if (error instanceof URIError || error.code === 'ERR_INVALID_ARG_VALUE') error.status = 400;
      next(error);
    });
  };
};
