import { test, expect } from '@playwright/test';
import { returningVisitor, ready, canvasFrame, observe, attachDiagnostics } from '../support/browser.mjs';

test.afterEach(attachDiagnostics);

test('a WebGL doodle submits draw calls and accepts pointer interaction', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  // Observe native draw calls in each document, including the archive iframe.
  await page.addInitScript(() => {
    window.baselineDrawCalls = 0;
    for (const type of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const prototype = window[type]?.prototype;
      if (!prototype) continue;
      for (const method of ['drawArrays', 'drawElements']) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          window.baselineDrawCalls++;
          return original.apply(this, args);
        };
      }
    }
  });
  await ready(page, '/_/silviopaganini/box-physics');
  const canvas = await canvasFrame(page, 'silviopaganini/box-physics');
  await expect.poll(() => canvas.evaluate(() => window.baselineDrawCalls)).toBeGreaterThan(2);
  await canvas.click();
  expect(errors).toEqual([]);
});
