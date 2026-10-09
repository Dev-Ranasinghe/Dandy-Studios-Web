"use client";

import { useEffect, useRef } from "react";
import OrbShader from "@/components/ui/orb-shader";
import styles from "./SnakeTrail.module.css";

const SAMPLES = 120;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Body width along the snake, 0 = neck, 1 = tail tip. Measured off the logo: neck at 0.8,
 * an even full body, then a taper through the last fifth to a needle tail. */
const widthAt = (s: number) => (0.8 + 0.2 * smoothstep(0, 0.18, s)) * (1 - smoothstep(0.66, 1, s) ** 1.4);

type Point = { x: number; y: number };
export type Geometry = {
  cx: number;
  amp: number;
  thick: number;
  wave: number;
  /** Body extent measured down the page, used to time the entrance and exit. */
  length: number;
  /** One period of the track, sampled by arc length. */
  track: { x: number; y: number; s: number }[];
  period: number;
};

// Pinches the track so it runs nearly flat across the page and turns in wide round loops, like the logo.
const FLATTEN = 0.28;
// Turns sit this many swings apart: opened up from the logo's 2.4 so the curves breathe.
const WAVE_RATIO = 3.9;
// Body length in turns, so every screen gets the same proportions (about 2.2, as on desktop).
const LENGTH_WAVES = 2.2;
// The snake runs under the statement, and the words invert where they cross it. Its centre sits
// over the right-hand part of the text. Every screen gets the same shape, only scaled.
const CENTER = { phone: 0.6, wide: 0.7 };
const BODY_RATIO = 0.45;
// The snake finishes its exit at this share of the pin; the rest is a short hold on the
// empty statement, so the next section never scrolls in while any of the snake is on screen.
const SNAKE_DONE = 0.85;
// With reduced motion there is no pin; the snake rests with its head just off the top edge.
const HEAD_OFFSCREEN = 0.04;

/** Sizes the snake to the screen: it grows with the width, but gently, so it never swamps the text. */
export function geometry(width: number, vh: number): Geometry {
  const phone = width < 768;
  const amp = Math.min(width * 0.19, 60 + width * 0.045);
  const thick = amp * BODY_RATIO;
  const wave = amp * WAVE_RATIO;

  const track: Geometry["track"] = [];
  let s = 0;
  for (let i = 0; i <= 400; i++) {
    const t = (i / 400) * Math.PI * 2;
    const x = amp * Math.sin(t);
    const y = (wave / (Math.PI * 2)) * (t - FLATTEN * Math.sin(2 * t));
    const prev = track[i - 1];
    if (prev) s += Math.hypot(x - prev.x, y - prev.y);
    track.push({ x, y, s });
  }
  const period = s;

  return {
    cx: width * (phone ? CENTER.phone : CENTER.wide),
    amp,
    thick,
    wave,
    length: wave * LENGTH_WAVES,
    track,
    period,
  };
}

/** A point on the endless track at arc length s (the track repeats every period). */
function pointAt(g: Geometry, s: number): Point {
  const n = Math.floor(s / g.period);
  const local = s - n * g.period;
  let lo = 0;
  let hi = g.track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.track[mid].s <= local) lo = mid;
    else hi = mid;
  }
  const a = g.track[lo];
  const b = g.track[hi];
  const f = b.s === a.s ? 0 : (local - a.s) / (b.s - a.s);
  return { x: g.cx + a.x + (b.x - a.x) * f, y: n * g.wave + a.y + (b.y - a.y) * f };
}

/**
 * The logo's snake slithering up the page. It slides along one fixed serpentine track,
 * so the body undulates exactly the way a real snake's does.
 */
export function drawSnake(g: Geometry, headY: number) {
  // Scroll drives the head down the page; convert that to distance along the track.
  const headS = (headY / g.wave) * g.period;
  const bodyS = (g.length / g.wave) * g.period;

  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    const s = headS + u * bodyS;
    const p = pointAt(g, s);
    const ahead = pointAt(g, s - 1);
    const behind = pointAt(g, s + 1);
    const tx = behind.x - ahead.x;
    const ty = behind.y - ahead.y;
    const norm = Math.hypot(tx, ty) || 1;
    const half = (g.thick * widthAt(u)) / 2;
    const nx = ty / norm;
    const ny = -tx / norm;
    left.push(`${(p.x + nx * half).toFixed(1)} ${(p.y + ny * half).toFixed(1)}`);
    right.push(`${(p.x - nx * half).toFixed(1)} ${(p.y - ny * half).toFixed(1)}`);
  }
  const body = `M${left.join("L")}L${right.reverse().join("L")}Z`;

  // The head leans with the track but stays mostly upright, as in the logo.
  const neck = pointAt(g, headS);
  const ahead = pointAt(g, headS - 1);
  const angle = (Math.atan2(ahead.x - neck.x, neck.y - ahead.y) * 180 * 0.3) / Math.PI;
  const head = `translate(${neck.x.toFixed(1)} ${neck.y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(g.thick / 20.9).toFixed(3)})`;

  return { body, head };
}

/**
 * Pins its children for a stretch of scroll while the snake crawls, head first, from below
 * the bottom edge until its tail has left the top. Only then does the page scroll on.
 */
export default function SnakeTrail({ children }: { children: React.ReactNode }) {
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const tongueRef = useRef<SVGPathElement>(null);
  const flipRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const pin = pinRef.current;
    const stage = stageRef.current;
    const bodyEl = bodyRef.current;
    const headEl = headRef.current;
    const tongueEl = tongueRef.current;
    const flipEl = flipRef.current;
    if (!pin || !stage || !bodyEl || !headEl || !tongueEl || !flipEl) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => geometry(stage.clientWidth, stage.clientHeight);
    let g = measure();

    let headY: number | null = null;
    let frame = 0;
    let visible = false;
    let time = 0;
    let last = 0;

    // Only touch the DOM when something changed. The words above blend against the snake, so
    // every repaint of it re-composites the text; an idle snake must cost nothing.
    let lastY = Number.NaN;
    let lastGeometry = g;
    let lastTongue = "";
    const paint = (y: number) => {
      // Written as "not close" so a NaN lastY (never drawn, or just flipped) forces a draw.
      if (!(Math.abs(y - lastY) <= 0.05) || g !== lastGeometry) {
        const { body, head } = drawSnake(g, y);
        bodyEl.setAttribute("d", body);
        headEl.setAttribute("transform", head);
        lastY = y;
        lastGeometry = g;
      }
      const tongue = (0.7 + 0.3 * Math.max(0, Math.sin(time * 3.1)) ** 6).toFixed(2);
      if (tongue !== lastTongue) {
        tongueEl.style.transform = `scaleY(${tongue})`;
        lastTongue = tongue;
      }
    };

    /*
     * The snake always faces the way you scroll. Scrolling down, it rises head first from the
     * bottom; scrolling up, the same snake is flipped and comes down head first from the top.
     * It is drawn in its own "rising" frame either way (head from `start` below the stage to
     * `end` past the top); when heading down, that frame is mirrored vertically.
     * It only turns around while fully off screen, so it never visibly jumps.
     */
    let heading: "up" | "down" = "up";
    let lastPinned: number | null = null;
    let lastFlip = "";

    const bounds = () => ({ start: stage.clientHeight + g.thick * 2, end: -g.length - g.thick * 3 });

    const progress = () => {
      const rect = pin.getBoundingClientRect();
      const travel = rect.height - stage.clientHeight;
      return travel > 0 ? Math.min(Math.max(-rect.top / travel, 0), 1) : 0;
    };

    // Where the head should be, in the rising frame. Each direction finishes its crossing with
    // a short hold to spare, so the neighbouring section never scrolls in over the snake.
    const target = (pinned: number) => {
      const { start, end } = bounds();
      const p =
        heading === "up"
          ? Math.min(pinned / SNAKE_DONE, 1)
          : 1 - Math.min(Math.max((pinned - (1 - SNAKE_DONE)) / SNAKE_DONE, 0), 1);
      return start + (end - start) * p;
    };

    const applyFlip = () => {
      const next = heading === "down" ? `translate(0 ${stage.clientHeight}) scale(1 -1)` : "";
      if (next !== lastFlip) {
        if (next) flipEl.setAttribute("transform", next);
        else flipEl.removeAttribute("transform");
        lastFlip = next;
        lastY = Number.NaN; // force a redraw in the new frame
      }
    };

    if (reduce) {
      paint(-stage.clientHeight * HEAD_OFFSCREEN);
      const ro = new ResizeObserver(() => {
        g = measure();
        paint(-stage.clientHeight * HEAD_OFFSCREEN);
      });
      ro.observe(stage);
      return () => ro.disconnect();
    }

    const loop = (now: number) => {
      // A frame can be stamped slightly before `last` was read: never let time run backwards.
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      time += dt;
      const pinned = progress();
      const { start, end } = bounds();

      // Turn around only while the snake is fully off screen.
      if (lastPinned !== null && Math.abs(pinned - lastPinned) > 1e-4) {
        const wants = pinned > lastPinned ? "up" : "down";
        const offscreen = headY === null || headY <= end + 0.5 || headY >= start - 0.5;
        if (wants !== heading && offscreen) {
          heading = wants;
          headY = null; // re-enter from the new side without easing across the screen
          applyFlip();
        }
      }
      lastPinned = pinned;

      const goal = target(pinned);
      // Eases toward the scroll position, so the snake glides rather than jumps. Once it should
      // be gone, it goes at once: a fast flick must never drag it over the next section.
      const gone = goal <= end + 0.5;
      headY = headY === null || gone ? goal : headY + (goal - headY) * Math.min(1, dt * 10);
      paint(headY);
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
    io.observe(pin);

    const ro = new ResizeObserver(() => {
      g = measure();
      lastFlip = "";
      applyFlip();
    });
    ro.observe(stage);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={pinRef} className={styles.pin}>
      <div ref={stageRef} className={styles.stage}>
        {/* A small sun in the top-left corner, behind the snake and the words. */}
        <OrbShader className={styles.orb} />
        {/* The snake runs under the text; words blend against it and invert where they cross. */}
        <svg className={styles.snake} aria-hidden="true">
          {/* Mirrored vertically while the snake is heading down the page. */}
          <g ref={flipRef}>
            <path ref={bodyRef} />
            {/* Head drawn pointing up in a 40-unit box, neck at the origin. */}
            <g ref={headRef}>
              <path ref={tongueRef} className={styles.tongue} d="M0 -30 V-38 M0 -38 C-1 -42 -4 -44 -5 -48 M0 -38 C1 -42 4 -44 5 -48" />
              <circle r="8.4" />
              <path d="M0 4 C-9 2 -13 -8 -12 -16 C-11 -24 -5 -31 0 -32 C5 -31 11 -24 12 -16 C13 -8 9 2 0 4Z" />
            </g>
          </g>
        </svg>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
