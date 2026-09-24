"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { StaticImageData } from "next/image";

export type HalftoneControl = {
  /** 0 = normal print, 1 = blank paper. Lets a timeline "print" the photo in. */
  setDevelop: (value: number) => void;
};

type Props = {
  src: StaticImageData;
  alt: string;
  /** Light tone; dark tone is the ink. */
  paper?: string;
  ink?: string;
  /** Size of one print grain in CSS pixels. */
  grain?: number;
  /** Focal point of the crop, 0–1 on each axis. */
  focus?: [number, number];
  zoom?: number;
  contrast?: number;
  /** Dragging (touch) or hovering (mouse) across the print shifts its exposure. */
  interactive?: boolean;
  onInteract?: () => void;
  controlRef?: RefObject<HalftoneControl | null>;
  className?: string;
};

const MAX_EXPOSURE = 0.32;

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Renders a photo as a two-tone, error-diffused print: the grainy
 * risograph look, built from the real image at the element's size.
 */
export default function HalftonePhoto({
  src,
  alt,
  paper = "#ff2e97",
  ink = "#000000",
  grain = 2,
  focus: [fx, fy] = [0.5, 0.5],
  zoom = 1,
  contrast = 1.35,
  interactive = false,
  onInteract,
  controlRef,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.decoding = "async";
    img.src = src.src;

    const [pr, pg, pb] = hexToRgb(paper);
    const [ir, ig, ib] = hexToRgb(ink);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Sampled once per size; exposure changes only re-run the dither.
    let base: Float32Array | null = null;
    let alpha: Uint8Array | null = null;
    let work = new Float32Array(0);
    let out: ImageData | null = null;
    let cols = 0;
    let rows = 0;
    let exposure = 0;
    let target = 0;
    let develop = 0;
    let frame = 0;
    let interacted = false;

    const sample = () => {
      if (!img.complete || !img.naturalWidth) return false;
      // Layout size, not the bounding box: entrance transforms must not change the grain.
      cols = Math.max(1, Math.round(canvas.clientWidth / grain));
      rows = Math.max(1, Math.round(canvas.clientHeight / grain));

      // Cover-crop the source around the focal point.
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(cols / iw, rows / ih) * zoom;
      const sw = cols / scale;
      const sh = rows / scale;
      const sx = Math.min(Math.max(fx * iw - sw / 2, 0), iw - sw);
      const sy = Math.min(Math.max(fy * ih - sh / 2, 0), ih - sh);

      canvas.width = cols;
      canvas.height = rows;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, cols, rows);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);

      const px = ctx.getImageData(0, 0, cols, rows).data;
      base = new Float32Array(cols * rows);
      alpha = new Uint8Array(cols * rows);
      for (let i = 0; i < base.length; i++) {
        const o = i * 4;
        base[i] = (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) / 255;
        alpha[i] = px[o + 3] < 128 ? 0 : 255;
      }
      work = new Float32Array(base.length);
      out = ctx.createImageData(cols, rows);
      return true;
    };

    const dither = () => {
      if (!base || !alpha || !out) return;
      for (let i = 0; i < base.length; i++) {
        work[i] = (base[i] - 0.5) * contrast + 0.5 + exposure + develop;
      }
      const px = out.data;
      // Atkinson dithering: drops some error on purpose, so shadows stay solid.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const on = work[i] > 0.5;
          const err = (work[i] - (on ? 1 : 0)) / 8;
          if (x + 1 < cols) work[i + 1] += err;
          if (x + 2 < cols) work[i + 2] += err;
          if (y + 1 < rows) {
            if (x > 0) work[i + cols - 1] += err;
            work[i + cols] += err;
            if (x + 1 < cols) work[i + cols + 1] += err;
          }
          if (y + 2 < rows) work[i + 2 * cols] += err;
          const o = i * 4;
          px[o] = on ? pr : ir;
          px[o + 1] = on ? pg : ig;
          px[o + 2] = on ? pb : ib;
          px[o + 3] = alpha[i];
        }
      }
      ctx.putImageData(out, 0, 0);
    };

    // Exposure eases toward its target instead of jumping, like a slow print.
    const tick = () => {
      const delta = target - exposure;
      exposure = Math.abs(delta) < 0.002 || reduceMotion ? target : exposure + delta * 0.2;
      dither();
      frame = exposure === target ? 0 : requestAnimationFrame(tick);
    };

    const redraw = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const resample = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      // Dither in the same task as the sample, so the raw photo is never painted.
      if (sample()) dither();
      if (exposure !== target) redraw();
    };

    const onMove = (event: PointerEvent) => {
      // Mouse exposes on hover; touch and pen only while pressed.
      if (event.pointerType !== "mouse" && event.buttons === 0) return;
      const rect = canvas.getBoundingClientRect();
      const t = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      target = (0.5 - t) * 2 * MAX_EXPOSURE;
      if (!interacted) {
        interacted = true;
        interactRef.current?.();
      }
      redraw();
    };

    const onLeave = () => {
      target = 0;
      redraw();
    };

    if (controlRef) {
      controlRef.current = {
        setDevelop: (value) => {
          if (value === develop) return;
          develop = value;
          dither();
        },
      };
    }

    img.addEventListener("load", resample);
    const observer = new ResizeObserver(resample);
    observer.observe(canvas);

    if (interactive) {
      canvas.addEventListener("pointerdown", onMove);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("pointerup", onLeave);
      canvas.addEventListener("pointercancel", onLeave);
    }

    return () => {
      if (controlRef) controlRef.current = null;
      cancelAnimationFrame(frame);
      img.removeEventListener("load", resample);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerup", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
    };
  }, [src, paper, ink, grain, fx, fy, zoom, contrast, interactive, controlRef]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{
        imageRendering: "pixelated",
        // Vertical swipes still scroll the page; horizontal drags expose the print.
        touchAction: interactive ? "pan-y" : undefined,
      }}
    />
  );
}
