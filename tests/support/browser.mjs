import { expect, test } from '@playwright/test';

export async function returningVisitor(page) {
  await page.addInitScript(() => localStorage.setItem('CD_VISITED', 'true'));
}
export async function ready(page, path = '/') {
  const response = await page.goto(path);
  expect(response.status()).toBe(200);
  await expect(page.locator('#preloader')).not.toHaveClass(/show-preloader/);
  await page.evaluate(() => document.fonts.ready);
}
export async function gridReady(page) {
  await expect(page.locator('[data-grid-item]')).toHaveCount(77);
  await expect(page.locator('[data-home-grid]')).toHaveClass(/after-intro-animation/);
}
export async function canvasFrame(page, slug) {
  const iframe = page.locator('[data-doodle-frame]');
  await expect(iframe).toHaveAttribute('src', `http://assets:8080/${slug}/index.html`);
  await expect(iframe).toHaveClass(/show/);
  const canvas = page.frameLocator('[data-doodle-frame]').locator('canvas').first();
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(node => node.width * node.height)).toBeGreaterThan(0);
  return canvas;
}

export function observe(page) {
  const errors = [];
  page.baselineErrors = errors;
  page.on('console', message => {
    if (message.type() === 'error' || message.text().startsWith('JQMIGRATE:') && message.type() === 'warning') errors.push(message.text());
  });
  page.on('pageerror', error => {
    // Existing hover previews do not catch the promise rejected by pause().
    // Allow only this observed cancellation, never arbitrary media/page errors.
    if (/^The play\(\) request was interrupted by a call to pause\(\)/.test(error.message) ||
        error.message === "The fetching process for the media resource was aborted by the user agent at the user's request.") {
      test.info().annotations.push({ type: 'known-defect', description: 'MEDIA-PLAY-ABORT: hover play/pause race' });
    } else errors.push(error.message);
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    // Navigating away cancels media streams legitimately. Other failures count.
    if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(request.failure()?.errorText || '')) {
      errors.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });
  return errors;
}

export async function attachDiagnostics({ page }, info) {
  if (info.status !== info.expectedStatus) {
    await info.attach('browser-diagnostics', {
      body: JSON.stringify({ errors: page.baselineErrors || [], frames: page.frames().map(frame => frame.url()) }, null, 2),
      contentType: 'application/json',
    });
  }
}
