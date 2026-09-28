import { setTimeout } from 'node:timers/promises';

export async function waitFor(url, predicate = () => true) {
  let last;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok && await predicate(response)) return;
      last = `HTTP ${response.status}, readiness condition not met`;
    } catch (error) { last = error.message; }
    await setTimeout(300);
  }
  throw new Error(`Readiness failed for ${url}: ${last}`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) await waitFor(process.argv[2]);
