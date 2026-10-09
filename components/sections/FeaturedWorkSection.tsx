"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import OrbitFlipSlider, { type OrbitFlipSliderItem } from "@/components/ui/orbit-flip-slider";
import HeatField from "@/components/ui/heat-field";
import { WORK } from "@/components/work";
import GlassLayer from "@/components/ui/GlassLayer";
import styles from "./FeaturedWorkSection.module.css";

const LINES = ["Work", "that", "speaks", "louder", "than", "words."];

// Sixteen cards around the orbit, cycling the work; each one leads to the work page.
const CARDS: OrbitFlipSliderItem[] = Array.from({ length: 16 }, (_, i) => {
  const piece = WORK[i % WORK.length];
  return { id: i, image: piece.poster, alt: "", label: piece.title, href: "/work" };
});

/** Card size and orbit spread for the current width: phones, tablets and desktops each get their own. */
function useOrbitSize() {
  const [size, setSize] = useState({ w: 150, h: 180, rx: 2, ry: 1.05, scale: 1 });
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      // The ring is wide and deep enough to pass above and below the statement it circles.
      if (vw < 768) setSize({ w: Math.round(vw * 0.2), h: Math.round(vw * 0.24), rx: 2.4, ry: 1.4, scale: 1 });
      else if (vw < 1100) setSize({ w: Math.round(vw * 0.13), h: Math.round(vw * 0.156), rx: 2, ry: 1.15, scale: 1 });
      else setSize({ w: Math.round(Math.min(vw * 0.105, 190)), h: Math.round(Math.min(vw * 0.126, 228)), rx: 2, ry: 1.05, scale: 1 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/**
 * Letters near the pointer stretch taller and their outline warms to the accent, falling off with distance, so a
 * wave follows the cursor across the statement. Written straight to CSS variables per letter.
 */
function useLetterWave(scope: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = Array.from(root.querySelectorAll<HTMLElement>("[data-letter]"));
    const current = letters.map(() => 0);
    const target = letters.map(() => 0);
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const step = () => {
      let moving = false;
      const radius = Math.max(120, window.innerWidth * 0.12);
      letters.forEach((el, i) => {
        if (pointer) {
          const r = el.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - pointer.x, r.top + r.height / 2 - pointer.y);
          target[i] = Math.max(0, 1 - d / radius) ** 2;
        } else target[i] = 0;
        const next = current[i] + (target[i] - current[i]) * 0.18;
        if (Math.abs(next - current[i]) > 0.001) moving = true;
        if (Math.abs(next - current[i]) > 0.0005 || next === 0) {
          current[i] = Math.abs(next) < 0.001 ? 0 : next;
          el.style.setProperty("--w", current[i].toFixed(3));
        }
      });
      frame = moving || pointer ? requestAnimationFrame(step) : 0;
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      wake();
    };
    const onLeave = () => {
      pointer = null;
      wake();
    };
    const host = root.closest("section") ?? root;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [scope]);
}

/**
 * Featured work on the home page: a stacked statement over a contour map, a thermal glow that
 * follows the pointer, and a tilted orbit of work that flips cards over on hover. Every card,
 * and the primary button, goes to the work page.
 */
export default function FeaturedWorkSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const size = useOrbitSize();
  const headlineRef = useRef<HTMLHeadingElement>(null);
  useLetterWave(headlineRef);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="featured-heading">
      <div className={styles.map} aria-hidden="true" />
      <HeatField host={sectionRef} className={styles.heat} />

      {/* The orbit circles the statement: far cards pass behind the words, near cards in front. */}
      <div className={styles.orbit}>
        <OrbitFlipSlider
          items={CARDS}
          initialMode="tilt"
          showModes={false}
          className="h-full"
          imageWidth={size.w}
          imageHeight={size.h}
          rounded="rounded-[6px]"
          rotateSpeed={5}
          tiltRotateX={68}
          tiltRadiusX={size.rx}
          tiltRadiusY={size.ry}
          tiltScale={size.scale}
          tiltMoveY={0}
        >
          <h2 ref={headlineRef} id="featured-heading" className={styles.headline} aria-label={LINES.join(" ")}>
            {LINES.map((line, i) => (
              <span key={line} className={styles.line} style={{ "--i": i } as React.CSSProperties} aria-hidden="true">
                {line.split("").map((ch, j) => (
                  <span key={j} className={styles.letter} data-letter>
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h2>
        </OrbitFlipSlider>
      </div>

      <div className={styles.foot}>
        <p className={styles.copy}>
          From launch sites and identities to motion and art direction: the work carries the brand, and keeps
          carrying it long after launch day.
        </p>
        <div className={styles.actions}>
          <a href="/work" className={`${styles.primary} glass-host glass-solid`}>
            <GlassLayer />
            See all work
            <ArrowRight aria-hidden="true" strokeWidth={2} />
          </a>
          <a href="/contact" className={`${styles.secondary} glass-host`}>
            <GlassLayer />
            Get in touch
          </a>
        </div>
      </div>
    </section>
  );
}
