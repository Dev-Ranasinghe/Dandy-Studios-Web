"use client";

import { useEffect, useRef } from "react";
import { hexToRgb255, useAccent, type AccentPalette } from "@/lib/accent";

/**
 * A thermal-camera glow that follows the pointer, in the site's palette: the pointer paints
 * heat into a small grid, the grid cools every frame, and each cell is coloured through a ramp
 * (plasma → lavender → highlight → bone, in the current accent). The canvas is drawn at low
 * resolution, blurred at that size, and scaled up by CSS, which gives the soft, liquid edge.
 * The blur runs on the canvas's own few thousand cells (canvas 2D filter) rather than as a CSS
 * filter over the whole section, which re-blurred millions of device pixels every frame. When the pointer is idle
 * (or on touch screens) a slow wandering spot keeps it alive. Runs only while on screen.
 */

type Props = {
  /** Element whose pointer movement paints heat; defaults to the canvas's parent. */
  host: React.RefObject<HTMLElement | null>;
  className?: string;
};

const CELL = 6; // CSS px per heat cell
const COOL = 0.972; // per-frame decay
const IDLE_MS = 1800; // pointer rest before the wanderer takes over
// The look the CSS filter used to give, in cell units (blur(12px) over 6px cells).
const FILTER = `blur(${12 / CELL}px) contrast(1.15)`;

// Heat → colour ramp, as [stop, r, g, b, a]: plasma → lavender → highlight → bone.
function rampStops(accent: AccentPalette): [number, number, number, number, number][] {
  const [plasma, lavender, highlight] = [accent.plasma, accent.lavender, accent.highlight].map(hexToRgb255);
  const between = lavender.map((c, i) => Math.round(c * 0.4 + highlight[i] * 0.6)) as typeof lavender;
  return [
    [0.0, ...plasma, 0],
    [0.1, ...plasma, 0.7],
    [0.28, ...lavender, 0.95],
    [0.58, ...between, 0.95],
    [0.8, ...highlight, 1],
    [1.0, 244, 243, 241, 1],
  ];
}

function buildRamp(stops: [number, number, number, number, number][]) {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, r0, g0, b0, a0] = stops[k];
    const [t1, r1, g1, b1, a1] = stops[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    lut[i * 4] = r0 + (r1 - r0) * f;
    lut[i * 4 + 1] = g0 + (g1 - g0) * f;
    lut[i * 4 + 2] = b0 + (b1 - b0) * f;
    lut[i * 4 + 3] = (a0 + (a1 - a0) * f) * 255;
  }
  return lut;
}

export default function HeatField({ host, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accent = useAccent();
  const lutRef = useRef<Uint8ClampedArray | null>(null);
  // A new accent swaps the ramp under the running loop; the heat itself carries on.
  useEffect(() => {
    lutRef.current = buildRamp(rampStops(accent));
  }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const el = host.current ?? canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !el || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    // The heat is written to an offscreen grid, then drawn through the filter onto the canvas.
    // Without canvas filters (older Safari) the CSS filter stays on instead.
    const grid = document.createElement("canvas");
    const gridCtx = grid.getContext("2d");
    ctx.filter = FILTER;
    const baked = !!gridCtx && ctx.filter === FILTER;
    if (baked) canvas.dataset.baked = "";
    const target = baked ? gridCtx! : ctx;

    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    let image: ImageData | null = null;

    const resize = () => {
      const r = el.getBoundingClientRect();
      cols = Math.max(8, Math.ceil(r.width / CELL));
      rows = Math.max(8, Math.ceil(r.height / CELL));
      canvas.width = grid.width = cols;
      canvas.height = grid.height = rows;
      // Resizing a canvas resets its context state.
      if (baked) ctx.filter = FILTER;
      heat = new Float32Array(cols * rows);
      image = target.createImageData(cols, rows);
    };
    resize();

    // A soft round stamp; radius in cells scales with the section's size.
    const stamp = (cx: number, cy: number, strength: number) => {
      const radius = Math.max(7, Math.min(cols, rows) * 0.075);
      const r2 = radius * radius;
      const x0 = Math.max(0, Math.floor(cx - radius));
      const x1 = Math.min(cols - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const y1 = Math.min(rows - 1, Math.ceil(cy + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 > r2) continue;
          const f = 1 - d2 / r2;
          const i = y * cols + x;
          heat[i] = Math.min(1, heat[i] + strength * f * f);
        }
      }
    };

    let last: { x: number; y: number } | null = null;
    let lastMove = 0;
    const paint = (x: number, y: number) => {
      // Stamp along the path so fast moves leave a continuous trail.
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const steps = Math.min(24, Math.ceil(Math.hypot(dx, dy) / 3));
        for (let s = 1; s <= steps; s++) stamp(last.x + (dx * s) / steps, last.y + (dy * s) / steps, 0.09);
      } else stamp(x, y, 0.12);
      last = { x, y };
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      paint((e.clientX - r.left) / CELL, (e.clientY - r.top) / CELL);
      lastMove = performance.now();
    };
    const onLeave = () => (last = null);

    let frame = 0;
    let visible = false;
    let t = Math.random() * 100;
    const loop = (now: number) => {
      // Idle: a slow Lissajous wanderer keeps a gentle glow moving.
      if (now - lastMove > IDLE_MS) {
        t += 0.006;
        const wx = cols * (0.5 + 0.34 * Math.sin(t * 1.3));
        const wy = rows * (0.5 + 0.3 * Math.sin(t * 0.9 + 1.2));
        stamp(wx, wy, 0.05);
        last = null;
      }
      const data = image!.data;
      const lut = lutRef.current!;
      for (let i = 0; i < heat.length; i++) {
        const h = (heat[i] *= COOL);
        const k = (Math.min(255, h * 255) | 0) * 4;
        const o = i * 4;
        data[o] = lut[k];
        data[o + 1] = lut[k + 1];
        data[o + 2] = lut[k + 2];
        data[o + 3] = lut[k + 3];
      }
      target.putImageData(image!, 0, 0);
      if (baked) {
        ctx.clearRect(0, 0, cols, rows);
        ctx.drawImage(grid, 0, 0);
      }
      frame = visible ? requestAnimationFrame(loop) : 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(loop);
    });
    io.observe(el);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      delete canvas.dataset.baked;
    };
  }, [host]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
