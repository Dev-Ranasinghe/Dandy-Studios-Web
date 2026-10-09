"use client";

import { useEffect, useRef } from "react";
import PortraitLoop from "./PortraitLoop";
import CursorTrail from "@/components/ui/cursor-trail";
import styles from "./StatementSection.module.css";

type Token = { kind: "word"; text: string } | { kind: "glyph" } | { kind: "portrait" };

const words = (text: string): Token[] => text.split(" ").map((w) => ({ kind: "word", text: w }));

const TOKENS: Token[] = [
  ...words("Dandy Studios is a one-person design and development studio"),
  { kind: "glyph" },
  ...words("crafting identities, websites, and interactions for ambitious brands"),
  { kind: "portrait" },
];

/** One shape in the mark: a rounded rect that can be a circle, an ellipse or a bar. */
type Shape = { x: number; y: number; w: number; h: number; rx: number; ry: number };

const circle = (cx: number, cy: number, r: number): Shape => ({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, rx: r, ry: r });
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({ x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2, rx, ry });
const bar = (x: number, y: number, w: number, h: number): Shape => ({ x, y, w, h, rx: 1, ry: 1 });

// Poses of the three shapes in a 60x80 box, after the reference's mark.
const POSES: Shape[][] = [
  [circle(34, 15, 11), circle(27, 40, 11), circle(34, 65, 11)],
  [circle(30, 17, 10), ellipse(30, 40, 22, 11), circle(30, 63, 10)],
  [bar(26, 12, 32, 12), circle(17, 40, 14), bar(26, 56, 32, 12)],
  [circle(30, 17, 10), ellipse(30, 40, 22, 11), circle(30, 63, 10)],
  [circle(30, 40, 26), circle(26, 36, 18), circle(43, 53, 6)],
];

const HOLD = 0.7; // seconds each pose rests
const MORPH = 0.65; // seconds between poses
const STEP = HOLD + MORPH;

const easeInOutExpo = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function shapeAt(seconds: number, i: number): Shape {
  const step = Math.floor(Math.max(seconds, 0) / STEP);
  const n = POSES.length;
  const from = POSES[step % n][i];
  const to = POSES[(step + 1) % n][i];
  const t = easeInOutExpo(Math.max(0, (seconds - step * STEP - HOLD) / MORPH));
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
    rx: lerp(from.rx, to.rx, t),
    ry: lerp(from.ry, to.ry, t),
  };
}

const attrs = (s: Shape) => ({
  x: s.x.toFixed(2),
  y: s.y.toFixed(2),
  width: s.w.toFixed(2),
  height: s.h.toFixed(2),
  rx: s.rx.toFixed(2),
  ry: s.ry.toFixed(2),
});

/** The studio's mark: three shapes that hold a pose, then snap-morph into the next. */
function Glyph() {
  const shapeRefs = useRef<(SVGRectElement | null)[]>([]);

  useEffect(() => {
    const shapes = shapeRefs.current.filter((r): r is SVGRectElement => r !== null);
    const svg = shapes[0]?.ownerSVGElement;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let visible = false;
    let elapsed = 0;
    let last = 0;

    const loop = (now: number) => {
      // A frame can be stamped slightly before `last` was read: never let time run backwards.
      elapsed += Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      shapes.forEach((el, i) => {
        for (const [key, value] of Object.entries(attrs(shapeAt(elapsed, i)))) el.setAttribute(key, value);
      });
      if (visible) frame = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    });
    io.observe(svg);

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg className={styles.glyph} viewBox="0 0 60 80" aria-hidden="true">
      {POSES[0].map((shape, i) => (
        <rect key={i} ref={(el) => void (shapeRefs.current[i] = el)} {...attrs(shape)} />
      ))}
    </svg>
  );
}

/** Words ink in one by one as the statement scrolls through the viewport. */
function useInkReveal(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const parts = Array.from(root.querySelectorAll<HTMLElement>("[data-ink]"));
    let frame = 0;
    let visible = false;

    // Recompute only when the paragraph has moved, and write only the words that changed:
    // while the section is pinned, this costs nothing per frame.
    let lastTop = Number.NaN;
    const shown = parts.map(() => "");
    const paint = () => {
      const rect = root.getBoundingClientRect();
      if (rect.top !== lastTop) {
        lastTop = rect.top;
        const vh = window.innerHeight;
        // 0 when the block's top reaches 95% of the viewport, 1 once it has risen to 45%,
        // so every word is inked before the section pins for the snake.
        const progress = Math.min(Math.max((vh * 0.95 - rect.top) / (vh * 0.5), 0), 1);
        const lit = progress * (parts.length + 2);
        parts.forEach((part, i) => {
          const t = Math.min(Math.max(lit - i, 0), 1);
          // Fully inked words drop the inline style entirely.
          const next = t >= 1 ? "" : (0.14 + t * 0.86).toFixed(3);
          if (next !== shown[i]) {
            part.style.opacity = next;
            shown[i] = next;
          }
        });
      }
      if (visible) frame = requestAnimationFrame(paint);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(paint);
    });
    io.observe(root);

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      parts.forEach((part) => (part.style.opacity = ""));
    };
  }, [ref]);
}

export default function StatementSection() {
  const textRef = useRef<HTMLParagraphElement>(null);
  useInkReveal(textRef);

  return (
    <section className={styles.section} aria-label="About Dandy Studios">
      <p ref={textRef} className={styles.statement}>
        {TOKENS.map((token, i) => {
          if (token.kind === "glyph")
            return (
              <span key={i} className={styles.inline} data-ink>
                <Glyph />
              </span>
            );
          if (token.kind === "portrait")
            return (
              <span key={i} className={`${styles.inline} ${styles.portrait}`} data-ink>
                <PortraitLoop />
              </span>
            );
          return (
            <span key={i} className={styles.word} data-ink>
              {token.text}
            </span>
          );
        })}
      </p>
      <CursorTrail />
    </section>
  );
}
