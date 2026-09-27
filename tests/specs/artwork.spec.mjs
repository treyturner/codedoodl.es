import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { ready } from '../support/browser.mjs';

const doodles = JSON.parse(readFileSync(new URL('../fixtures/api.json', import.meta.url))).doodles;
const baselinePath = new URL('../baselines/artwork.json', import.meta.url);
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath)) : {};
const record = process.env.ARTWORK_RECORD === '1';

for (const doodle of doodles) {
  test(`archive: ${doodle.slug}`, async ({ page }, info) => {
    const errors = new Set();
    const failedRequests = new Set();
    page.on('pageerror', error => errors.add(error.message));
    page.on('response', response => { if (response.status() >= 400) failedRequests.add(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      if (!/ERR_ABORTED|cancelled|canceled/i.test(request.failure()?.errorText || '')) failedRequests.add(request.url());
    });
    await page.addInitScript(() => {
      if (location.origin === 'http://site.test:3000') localStorage.setItem('CD_VISITED', 'true');
    });
    await page.addInitScript(() => {
      window.artworkDraws = 0;
      for (const [type, methods] of [
        ['CanvasRenderingContext2D', ['fill', 'stroke', 'fillRect', 'drawImage', 'putImageData', 'fillText']],
        ['WebGLRenderingContext', ['drawArrays', 'drawElements']],
        ['WebGL2RenderingContext', ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']],
      ]) {
        const prototype = window[type]?.prototype;
        if (!prototype) continue;
        for (const method of methods) {
          const original = prototype[method];
          prototype[method] = function (...args) { window.artworkDraws++; return original.apply(this, args); };
        }
      }
    });
    await ready(page, `/_/${doodle.slug}`);
    const iframe = page.locator('[data-doodle-frame]');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', `http://assets:8080/${doodle.slug}/index.html`);
    const element = await iframe.elementHandle();
    const frame = await element.contentFrame();
    await frame.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // Reuse the resolved iframe: repeated selector resolution can wait behind
    // seconds-long software WebGL frames on CPU-only CI runners.
    const bounds = await element.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 3, bounds.y + bounds.height / 3);
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1000);
    const rendering = await frame.evaluate(() => ({
      drew: window.artworkDraws > 0,
      canvases: document.querySelectorAll('canvas').length,
      svg: document.querySelectorAll('svg').length,
      media: document.querySelectorAll('video,audio').length,
    }));
    const observation = { slug: doodle.slug, rendering, errors: [...errors].sort(), failedRequests: [...failedRequests].sort() };
    mkdirSync('/results/artwork', { recursive: true });
    const name = doodle.slug.replace('/', '--');
    writeFileSync(`/results/artwork/${name}.json`, JSON.stringify(observation, null, 2));
    // Capture the known viewport rectangle without waiting for animated iframe layout to stabilize.
    await page.screenshot({ path: `/results/artwork/${name}.png`, clip: bounds, timeout: 30000 });
    await info.attach('artwork-observation', { body: JSON.stringify(observation), contentType: 'application/json' });
    if (!record) {
      const previous = baseline[doodle.slug];
      expect(previous, 'Each artwork must have a reviewed original-image observation').toBeDefined();
      if (previous.rendering.drew) expect(rendering.drew, 'Artwork must still submit drawing commands').toBe(true);
      expect(observation.errors.filter(error => !previous.errors.includes(error)), 'New frame errors').toEqual([]);
      expect(observation.failedRequests.filter(url => !previous.failedRequests.includes(url)), 'New failed asset requests').toEqual([]);
    }
  });
}
