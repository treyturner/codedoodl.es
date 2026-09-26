import { test, expect } from '@playwright/test';
import { returningVisitor, ready, gridReady, canvasFrame, observe, attachDiagnostics } from '../support/browser.mjs';

test.afterEach(attachDiagnostics);

test('home grid, fonts, thumbnails, and stable shell screenshot', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  await expect(page.locator('[data-grid-item] a').first()).toHaveAttribute('href', 'http://site.test:3000/_/dmnsgn/oitnb');
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family);
  });
  expect(font.length).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('home.png', { animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('first-visit entry screen can be dismissed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The first-visit prompt is intentionally desktop-only.');
  const errors = observe(page);
  await page.goto('/');
  const enter = page.locator('[data-intro-btn="enter"]');
  await expect(enter).toBeVisible();
  await enter.click();
  await page.mouse.move(0, 0);
  await expect(page.locator('#preloader')).not.toHaveClass(/show-preloader/);
  await gridReady(page);
  expect(await page.evaluate(() => localStorage.getItem('CD_VISITED'))).toBe('true');
  expect(errors).toEqual([]);
});

test('about/contribute navigation and browser history work without full reloads', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  await page.evaluate(() => { window.baselineNavigationMarker = 'preserved'; });
  await page.locator('.about-btn').click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('#page-about')).toBeVisible();
  await expect(page.locator('.sponsor-nexus img')).toHaveAttribute('src', 'http://site.test:3000/static/img/logos/nexus_70.png');
  await expect(page.locator('#page-about a[href*="chrome.google.com"]')).toHaveAttribute('href', /hhfnbfhcojlgbojpphigjibpjkccfikh$/);
  await page.locator('.contribute-btn').click();
  await expect(page).toHaveURL(/\/contribute\/?$/);
  await expect(page.locator('#page-contribute')).toBeVisible();
  await expect(page.locator('[data-contributors]')).toContainText('Damien Seguin');
  await page.goBack();
  await expect(page.locator('#page-about')).toBeVisible();
  expect(await page.evaluate(() => window.baselineNavigationMarker)).toBe('preserved');
  expect(errors).toEqual([]);
});

test('doodle deep link renders a moving canvas, info, reload, and navigation', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page, '/_/gianab/neon-bubbles');
  const canvas = await canvasFrame(page, 'gianab/neon-bubbles');
  const before = await canvas.evaluate(node => node.toDataURL());
  await expect.poll(() => canvas.evaluate(node => node.toDataURL())).not.toBe(before);
  await page.locator('[data-show-info]').click();
  await expect(page.locator('#page-doodle')).toHaveClass(/show-info/);
  await expect(page.locator('[data-doodle-info]')).toContainText('Random interactive particles');
  await expect(page.locator('[data-doodle-info] a[href="http://site.test:3000/yrg"]')).toHaveCount(1);
  await page.locator('.close-btn').click();
  await expect(page.locator('#page-doodle')).not.toHaveClass(/show-info/);
  await Promise.all([
    page.waitForEvent('framenavigated', frame => frame.url().includes('/gianab/neon-bubbles/index.html')),
    page.locator('[data-doodle-refresh]').click(),
  ]);
  await canvasFrame(page, 'gianab/neon-bubbles');
  const next = page.locator('[data-doodle-nav="next"]');
  const previous = page.locator('[data-doodle-nav="prev"]');
  const navigation = await next.getAttribute('href') ? next : previous;
  const destination = await navigation.getAttribute('href');
  expect(destination).toContain('/_/');
  await navigation.click();
  await expect(page).toHaveURL(new RegExp(new URL(destination).pathname + '/?$'));
  await page.goBack();
  await canvasFrame(page, 'gianab/neon-bubbles');
  expect(errors).toEqual([]);
});

test('mobile fallback keeps unsupported doodles accessible as a preview', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only fallback.');
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page, '/_/andrevenancio/infinite-spaces');
  await expect(page.locator('[data-doodle-instructions]')).toHaveClass(/show-fallback/);
  await expect(page.locator('[data-doodle-instructions] a')).toHaveAttribute('href', /\/andrevenancio\/infinite-spaces\/thumb\.(mp4|webm)$/);
  await expect(page.locator('[data-doodle-frame]')).toHaveAttribute('src', '');
  expect(errors).toEqual([]);
});
