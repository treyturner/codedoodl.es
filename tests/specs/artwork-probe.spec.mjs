import { test, expect } from '@playwright/test';
import { observeArtworkRendering, trackArtworkDrawing } from '../support/artwork.mjs';

async function canvasFixture(page) {
  await page.addInitScript(trackArtworkDrawing);
  await page.route('http://assets:8080/drawing-probe.html', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><canvas width="100" height="100"></canvas>',
  }));
  await page.setContent('<iframe src="http://assets:8080/drawing-probe.html"></iframe>');
  await page.frameLocator('iframe').locator('canvas').waitFor();
  return page.frame({ url: 'http://assets:8080/drawing-probe.html' });
}

test('artwork probe waits for drawing that starts after the initial observation', async ({ page }) => {
  const frame = await canvasFixture(page);
  const initial = await observeArtworkRendering(frame);
  expect(initial).toEqual({ drew: false, canvases: 1, svg: 0, media: 0 });
  await frame.evaluate(() => {
    setTimeout(() => document.querySelector('canvas').getContext('2d').fillRect(0, 0, 10, 10), 500);
  });
  const rendering = await observeArtworkRendering(frame, { waitForDrawing: true, timeout: 5000 });
  expect(rendering).toEqual({ ...initial, drew: true });
});

test('artwork probe times out with a failed observation for a canvas that only clears', async ({ page }) => {
  const frame = await canvasFixture(page);
  await frame.evaluate(() => {
    const context = document.querySelector('canvas').getContext('2d');
    setInterval(() => context.clearRect(0, 0, 100, 100), 10);
  });
  const rendering = await observeArtworkRendering(frame, { waitForDrawing: true, timeout: 250 });
  expect(rendering).toEqual({ drew: false, canvases: 1, svg: 0, media: 0 });
});

test('artwork probe propagates frame failures instead of treating them as a drawing timeout', async ({ page }) => {
  const frame = await canvasFixture(page);
  // Detach while the drawing wait is pending, after the first state evaluation.
  await page.evaluate(() => addEventListener('message', () => document.querySelector('iframe').remove(), { once: true }));
  await frame.evaluate(() => setTimeout(() => parent.postMessage('remove-frame', '*'), 500));
  await expect(observeArtworkRendering(frame, { waitForDrawing: true, timeout: 5000 })).rejects.toThrow(/detached/i);
});
