import { errors } from '@playwright/test';

// Installed before navigation, including inside each artwork iframe.
export function trackArtworkDrawing() {
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
}

function renderingState() {
  return {
    drew: window.artworkDraws > 0,
    canvases: document.querySelectorAll('canvas').length,
    svg: document.querySelectorAll('svg').length,
    media: document.querySelectorAll('video,audio').length,
  };
}

export async function observeArtworkRendering(frame, { waitForDrawing = false, timeout = 45000 } = {}) {
  const initial = await frame.evaluate(renderingState);
  if (!waitForDrawing || initial.drew) return initial;
  // Dispositions starts with randomly placed geometry behind its camera. Its
  // first visible draw depends on animation progress, not just document load.
  // Only wait when the reviewed baseline requires drawing, and never retry or
  // reload the sketch. A blank canvas must still fail the caller's assertion.
  try {
    const drawn = await frame.waitForFunction(() => window.artworkDraws > 0, undefined, { timeout, polling: 100 });
    await drawn.dispose();
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    // Preserve the observation/screenshot before the normal comparison fails.
  }
  return frame.evaluate(renderingState);
}
