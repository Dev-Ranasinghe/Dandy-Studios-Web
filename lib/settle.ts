/**
 * Resolves once the page is calm again: a run of smooth frames, then an idle slot.
 * Used to stage heavy work (camera, hand tracking) so its start and stop never land
 * on top of other work. Always resolves by `maxMs`, so nothing can hang on it.
 */
export function whenSettled({ frames = 5, frameBudget = 20, maxMs = 1500 } = {}): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let last = started;
    let smooth = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      // Safari has no requestIdleCallback; a short timeout stands in.
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 300 });
      else setTimeout(resolve, 50);
    };

    const step = (now: number) => {
      smooth = now - last <= frameBudget ? smooth + 1 : 0;
      last = now;
      if (smooth >= frames || now - started >= maxMs) finish();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // rAF does not run in a background tab; the cap still applies there.
    window.setTimeout(finish, maxMs + 100);
  });
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
