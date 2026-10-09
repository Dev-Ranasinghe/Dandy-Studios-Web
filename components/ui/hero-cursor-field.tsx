"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { hexToRgb255, useAccent } from "@/lib/accent";

/**
 * The hero's pointer effect: an accent dot-matrix spotlight that trails the (native) pointer. The canvas only draws while something is lit, and only while
 * the hero is on screen. A tracked hand (camera mode) can drive it in place of the mouse.
 */

export type CursorFieldHandle = {
  /** Frame-relative point from hand tracking, or null when no hand is seen. */
  setHand: (point: { x: number; y: number } | null) => void;
};

type Props = {
  /** The element whose bounds the field covers and whose pointer events it follows. */
  host: React.RefObject<HTMLElement | null>;
  /** Camera mode: a larger, denser field. */
  wide?: boolean;
  className?: string;
};

const PITCH = 6; // px between dots
const TRAIL = 9; // remembered positions; gives the vertical smear when moving fast

const HeroCursorField = forwardRef<CursorFieldHandle, Props>(function HeroCursorField(
  { host, wide = false, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<{ x: number; y: number } | null>(null);
  const wideRef = useRef(wide);
  const wakeRef = useRef<() => void>(() => {});
  const repaintRef = useRef<() => void>(() => {});
  wideRef.current = wide;

  // The dots and streaks are the raw highlight colour of whichever theme is picked.
  const signal = hexToRgb255(useAccent().highlight).join(", ");
  const signalRef = useRef(signal);
  signalRef.current = signal;
  useEffect(() => {
    repaintRef.current();
  }, [signal]);

  useImperativeHandle(ref, () => ({
    setHand(point) {
      handRef.current = point;
      wakeRef.current();
    },
  }));

  useEffect(() => {
    const el = host.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!el || !canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      patterns = [1, 2, 3.2].map(makePattern);
    };

    // One tile of the dot matrix, drawn at device resolution; the pattern is anchored to the
    // canvas, so the grid stays put and the spotlight only reveals it.
    const makePattern = (stretch: number) => {
      const tile = document.createElement("canvas");
      const size = Math.round(PITCH * dpr);
      tile.width = tile.height = size;
      const t = tile.getContext("2d")!;
      t.fillStyle = `rgb(${signalRef.current})`;
      const w = 2 * dpr;
      const h = Math.min(w * stretch, size - dpr);
      t.fillRect((size - w) / 2, (size - h) / 2, w, h);
      const pattern = ctx.createPattern(tile, "repeat")!;
      pattern.setTransform(new DOMMatrix().scale(1 / dpr));
      return pattern;
    };
    let patterns: CanvasPattern[] = [];
    resize();
    repaintRef.current = () => {
      patterns = [1, 2, 3.2].map(makePattern);
    };

    const pointer = { x: 0, y: 0, inside: false };
    const spot = { x: 0, y: 0 };
    const trail: { x: number; y: number }[] = [];
    let strength = 0; // 0..1, fades the whole field in and out
    let radius = 130;
    let speed = 0; // eased px per frame; stretches the dots into scan lines only while moving
    let spin = 0; // rotation of the hand disc's streaks
    let frame = 0;
    let running = false;
    let visible = true;

    const target = () => handRef.current ?? (pointer.inside ? pointer : null);

    const draw = () => {
      const goal = target();
      const goalRadius = wideRef.current && handRef.current ? Math.min(width, height) * 0.24 : wideRef.current ? 170 : 130;
      radius += (goalRadius - radius) * 0.08;
      strength += ((goal ? 1 : 0) - strength) * (goal ? 0.14 : 0.06);

      if (goal) {
        const follow = reduce ? 1 : handRef.current ? 0.3 : 0.12;
        spot.x += (goal.x - spot.x) * follow;
        spot.y += (goal.y - spot.y) * follow;
      }

      const prev = trail[0];
      const moved = prev ? Math.hypot(spot.x - prev.x, spot.y - prev.y) : 0;
      speed += (moved - speed) * 0.2;
      spin += 0.012 + speed * 0.002;
      const hand = wideRef.current && handRef.current !== null;

      trail.unshift({ x: spot.x, y: spot.y });
      if (trail.length > (reduce ? 1 : TRAIL)) trail.pop();

      ctx.clearRect(0, 0, width, height);
      if (strength > 0.01) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of trail) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const bx = minX - radius, by = minY - radius;
        const bw = maxX - minX + radius * 2, bh = maxY - minY + radius * 2;

        // 1. A soft alpha mask: one radial blob per trail point, oldest first and faintest.
        ctx.globalCompositeOperation = "source-over";
        for (let i = trail.length - 1; i >= 0; i--) {
          const p = trail[i];
          const a = strength * (1 - i / (trail.length + 1)) * (hand ? 0.75 : 0.55);
          if (a < 0.01) continue;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          if (hand) {
            // Hard-edged, even disc.
            g.addColorStop(0, `rgba(0,0,0,${a})`);
            g.addColorStop(0.92, `rgba(0,0,0,${a * 0.55})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
          } else {
            g.addColorStop(0, `rgba(0,0,0,${a})`);
            g.addColorStop(0.35, `rgba(0,0,0,${a * 0.45})`);
            g.addColorStop(0.7, `rgba(0,0,0,${a * 0.1})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
          }
          ctx.fillStyle = g;
          ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
        }

        // 2. Fill the mask with the fixed accent dot matrix; square at rest, scan lines with speed.
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = patterns[speed > 10 ? 2 : speed > 4 ? 1 : 0];
        ctx.fillRect(bx, by, bw, bh);
        ctx.globalCompositeOperation = "source-over";

        if (hand) {
          // Accent streaks orbiting the disc, as in the reference's camera state.
          ctx.strokeStyle = `rgba(${signalRef.current}, ${(0.75 * strength).toFixed(3)})`;
          ctx.lineCap = "round";
          for (let k = 0; k < 7; k++) {
            const r = radius * (0.45 + ((k * 37) % 50) / 100);
            const start = spin * (k % 2 ? 1 : -1.3) + k * 0.9;
            ctx.lineWidth = 1.5 + (k % 3);
            ctx.beginPath();
            ctx.arc(spot.x, spot.y, r, start, start + 0.5 + (k % 3) * 0.3);
            ctx.stroke();
          }
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const settled = !goal && strength < 0.01;
      if (settled || !visible) {
        running = false;
        ctx.clearRect(0, 0, width, height);
        trail.length = 0;
        return;
      }
      frame = requestAnimationFrame(draw);
    };

    const wake = () => {
      if (running || !visible) return;
      running = true;
      frame = requestAnimationFrame(draw);
    };
    wakeRef.current = wake;

    const local = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (!pointer.inside && !running) {
        // Enter from rest: start the field under the pointer rather than sliding in from the old spot.
        spot.x = p.x;
        spot.y = p.y;
      }
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.inside = true;
      wake();
    };
    const onLeave = () => {
      pointer.inside = false;
      wake();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointercancel", onLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
      else {
        cancelAnimationFrame(frame);
        running = false;
      }
    });
    io.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointercancel", onLeave);
      ro.disconnect();
      io.disconnect();
    };
  }, [host]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});

export default HeroCursorField;
