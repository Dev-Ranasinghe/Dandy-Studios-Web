"use client";

import { useEffect, useRef } from "react";
import type { StaticImageData } from "next/image";

type Props = {
  src: StaticImageData;
  alt: string;
  className?: string;
  /** Colour of the dithered darks. */
  ink: string;
  /** Colour of the lights. Transparent parts of the source stay transparent. */
  ground: string;
  /** Size of one dither dot in CSS pixels. */
  dot?: number;
  /** Levels applied before dithering: input black and white points (0..1). */
  levels?: [number, number];
  /**
   * For cut-outs: a rim of this many dots in the ground colour around the figure, so dark
   * edges (hair, clothing) still read against a dark background.
   */
  outline?: number;
};

const parse = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/** Atkinson dither to one bit: true where the pixel prints as ink. */
function atkinson(lum: Float32Array, w: number, h: number) {
  const out = new Uint8Array(w * h);
  const push = (x: number, y: number, e: number) => {
    if (x >= 0 && x < w && y < h) lum[y * w + x] += e;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const on = lum[i] < 0.5;
      out[i] = on ? 1 : 0;
      const e = (lum[i] - (on ? 0 : 1)) / 8;
      push(x + 1, y, e);
      push(x + 2, y, e);
      push(x - 1, y + 1, e);
      push(x, y + 1, e);
      push(x + 1, y + 1, e);
      push(x, y + 2, e);
    }
  }
  return out;
}

/**
 * A photo printed as 1-bit pixels, like an early Mac screen. When it scrolls into view the
 * dots resolve from coarse to fine; after that it is a still image.
 */
export default function DitherImage({ src, alt, className, ink, ground, dot = 3.5, levels = [0.16, 0.86], outline = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Plain numbers as dependencies: a parent re-rendering (the footer's clock ticks every
  // second) must not redraw or replay the resolve.
  const [black, white] = levels;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [ir, ig, ib] = parse(ink);
    const [gr, gg, gb] = parse(ground);
    const img = new window.Image();
    img.decoding = "async";
    img.src = src.src;

    const render = (cols: number) => {
      const rows = Math.max(1, Math.round((cols * src.height) / src.width));
      const probe = document.createElement("canvas");
      probe.width = cols;
      probe.height = rows;
      const pctx = probe.getContext("2d", { willReadFrequently: true });
      if (!pctx) return;
      pctx.imageSmoothingQuality = "high";
      pctx.drawImage(img, 0, 0, cols, rows);
      const data = pctx.getImageData(0, 0, cols, rows);
      const px = data.data;

      const lum = new Float32Array(cols * rows);
      for (let i = 0; i < lum.length; i++) {
        const l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
        lum[i] = Math.min(Math.max((l - black) / (white - black), 0), 1);
      }
      const bits = atkinson(lum, cols, rows);

      const opaque = new Uint8Array(cols * rows);
      for (let i = 0; i < opaque.length; i++) opaque[i] = px[i * 4 + 3] > 110 ? 1 : 0;
      // Rim: transparent cells within `outline` dots of the figure print in the ground colour.
      const rim = new Uint8Array(cols * rows);
      if (outline > 0) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            if (opaque[i]) continue;
            search: for (let dy = -outline; dy <= outline; dy++) {
              for (let dx = -outline; dx <= outline; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || dx * dx + dy * dy > outline * outline) continue;
                if (opaque[ny * cols + nx]) {
                  rim[i] = 1;
                  break search;
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < bits.length; i++) {
        const inked = opaque[i] && bits[i];
        px[i * 4] = inked ? ir : gr;
        px[i * 4 + 1] = inked ? ig : gg;
        px[i * 4 + 2] = inked ? ib : gb;
        px[i * 4 + 3] = opaque[i] || rim[i] ? 255 : 0;
      }
      canvas.width = cols;
      canvas.height = rows;
      ctx.putImageData(data, 0, 0);
    };

    const finalCols = () => Math.max(24, Math.round(canvas.clientWidth / dot));
    let timers: number[] = [];
    let played = false;

    const resolve = () => {
      const target = finalCols();
      if (reduce || played) return render(target);
      played = true;
      // Coarse to fine, one step every ~110ms.
      [8, 4, 2, 1].forEach((div, step) => {
        timers.push(window.setTimeout(() => render(Math.max(12, Math.round(target / div))), step * 110));
      });
    };

    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || visible) return;
        visible = true;
        if (img.complete) resolve();
        else img.onload = resolve;
      },
      { threshold: 0.25 },
    );

    // Paint a first pass right away so the canvas is never blank, then resolve on view.
    const first = () => render(reduce ? finalCols() : Math.max(12, Math.round(finalCols() / 8)));
    if (img.complete) first();
    else img.addEventListener("load", first, { once: true });
    io.observe(canvas);

    let lastWidth = canvas.clientWidth;
    const ro = new ResizeObserver(() => {
      if (!img.complete || Math.abs(canvas.clientWidth - lastWidth) < 2) return;
      lastWidth = canvas.clientWidth;
      if (visible) render(finalCols());
    });
    ro.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      timers.forEach(clearTimeout);
      timers = [];
    };
  }, [src, ink, ground, dot, black, white, outline]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={className}
      style={{ aspectRatio: `${src.width} / ${src.height}`, imageRendering: "pixelated" }}
    />
  );
}
