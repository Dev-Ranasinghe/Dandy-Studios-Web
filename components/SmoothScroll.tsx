"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Set on <html> while something owns the page's scroll (the hero's camera gate, the open menu). */
export const SCROLL_HELD_ATTR = "data-scroll-held";

/**
 * The page's eased scroll (Lenis), for mouse wheels and trackpads; touch keeps the device's own
 * scrolling. Lenis runs off GSAP's ticker, so every scroll-driven animation and the eased scroll
 * advance in the same frame, and ScrollTrigger hears every step. Nested scroll areas opt out with
 * `data-lenis-prevent`; reduced motion keeps native scrolling.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const root = document.documentElement;
    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.9,
      smoothWheel: true,
      autoRaf: false,
      // A held page (camera gate, open menu) gets its wheel events untouched, so its own handlers decide.
      virtualScroll: () => !root.hasAttribute(SCROLL_HELD_ATTR),
    });
    lenis.on("scroll", ScrollTrigger.update);
    // Shared with UI that scrolls the page itself (the timeline's scene jumps).
    (window as Window & { __lenis?: Lenis }).__lenis = lenis;
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Stop easing the page while it is held, so a held wheel can't drift it afterwards.
    const observer = new MutationObserver(() => {
      if (root.hasAttribute(SCROLL_HELD_ATTR)) lenis.stop();
      else lenis.start();
    });
    observer.observe(root, { attributes: true, attributeFilter: [SCROLL_HELD_ATTR] });

    return () => {
      observer.disconnect();
      gsap.ticker.remove(raf);
      lenis.destroy();
      delete (window as Window & { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return null;
}
