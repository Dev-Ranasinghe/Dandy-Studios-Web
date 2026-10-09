/**
 * Backing-store size for the full-section shaders. Their gradients are soft, so drawing them at
 * the display's full density (4x the pixels at 2x DPR) costs the GPU far more than it shows.
 * The scale is capped by a DPR ceiling and a pixel budget, and steps down on its own when the
 * device can't hold the frame rate: a weak GPU ends up with a softer shader, not a stuttering page.
 */
export type RenderBudget = {
  /** Device pixels per CSS pixel for a canvas of this CSS size. */
  scale: (cssWidth: number, cssHeight: number) => number;
  /** Call with rAF's timestamp on every drawn frame; true when the scale just dropped and the canvas should resize. */
  frame: (now: number) => boolean;
  /** Call when the loop restarts after a pause, so the gap isn't counted as a slow frame. */
  reset: () => void;
};

const SLOW_FRAME_MS = 22; // under ~45fps
const WINDOW = 60; // frames per verdict
const SLOW_SHARE = 0.25; // a quarter of the window running slow steps the quality down
const STEP = 0.8;

export function createRenderBudget({ maxDpr = 1.5, maxPixels = 1_000_000, minQuality = 0.5 } = {}): RenderBudget {
  let quality = 1;
  let last = 0;
  let frames = 0;
  let slow = 0;

  return {
    scale(cssWidth, cssHeight) {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const fit = Math.sqrt(maxPixels / Math.max(1, cssWidth * cssHeight));
      return Math.min(dpr, fit) * quality;
    },
    frame(now) {
      const dt = last ? now - last : 0;
      last = now;
      // A long gap is a pause (tab hidden, loop stopped), not a slow frame.
      if (!dt || dt > 250) return false;
      frames++;
      if (dt > SLOW_FRAME_MS) slow++;
      if (frames < WINDOW) return false;
      const struggling = slow / frames > SLOW_SHARE;
      frames = 0;
      slow = 0;
      if (!struggling || quality <= minQuality) return false;
      quality = Math.max(minQuality, quality * STEP);
      return true;
    },
    reset() {
      last = 0;
    },
  };
}
