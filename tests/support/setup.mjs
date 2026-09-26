import { waitFor } from './wait.mjs';

export default async function setup() {
  for (const host of ['app', 'preview', 'auth', 'fallback', 'partial']) {
    await waitFor(`http://${host}:3000/api/doodles`, async response => {
      const data = await response.json();
      // Exact contents/counts belong to the contract tests, so regressions get
      // useful diffs instead of being mistaken for a startup timeout.
      return Array.isArray(data.doodles);
    });
  }
}
