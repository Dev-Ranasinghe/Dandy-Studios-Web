"use client";

import { useEffect } from "react";

// How long after the last scroll movement the page counts as "still".
const SETTLE_MS = 160;
/** Fired on window once scrolling settles, so pointer-driven UI can re-check what is under a still pointer. */
export const SCROLL_SETTLE_EVENT = "scrollsettle";

/**
 * Native scrolling, with a signal for pointer-driven UI: while the page is moving, <html>
 * carries `data-scrolling`; when it stops, `scrollsettle` fires. Hover effects that resize
 * layout or start media wait for the settle, so content sliding under a still pointer
 * never triggers them mid-scroll.
 */
export default function ScrollState() {
  useEffect(() => {
    const root = document.documentElement;
    let settle = 0;
    const markScrolling = () => {
      root.dataset.scrolling = "";
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        delete root.dataset.scrolling;
        window.dispatchEvent(new Event(SCROLL_SETTLE_EVENT));
      }, SETTLE_MS);
    };
    window.addEventListener("scroll", markScrolling, { passive: true });
    return () => {
      window.removeEventListener("scroll", markScrolling);
      window.clearTimeout(settle);
      delete root.dataset.scrolling;
    };
  }, []);

  return null;
}
