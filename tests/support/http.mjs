import { request } from 'node:http';
import { gunzipSync } from 'node:zlib';

// Node fetch/Playwright decode gzip automatically. Raw HTTP is needed to catch
// falsely labelled bodies and double compression, not merely status codes.
export function raw(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers: { 'Accept-Encoding': 'gzip', ...headers } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(10000, () => req.destroy(new Error(`Timed out: ${url}`)));
    req.on('error', reject);
    req.end(body);
  });
}
export function decode(response) {
  return response.headers['content-encoding'] === 'gzip' ? gunzipSync(response.body) : response.body;
}
export async function json(url) {
  const response = await raw(url);
  if (response.status !== 200) throw new Error(`HTTP ${response.status}: ${url}`);
  return JSON.parse(decode(response));
}
