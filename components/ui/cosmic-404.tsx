"use client";

import createGlobe, { type COBEOptions } from "cobe";
import { useEffect, useRef } from "react";
import { hexToRgb255, useAccent, type AccentPalette } from "@/lib/accent";
import { cn } from "@/lib/utils";

type RGB = [number, number, number];

const unit = (hex: string): RGB => hexToRgb255(hex).map((c) => c / 255) as RGB;

export type GlobeTone = "light" | "dark";

/** Lighting per ground: a pale sphere with soft land for bone, a lit night sphere for dark grounds. */
const TONES: Record<GlobeTone, Partial<COBEOptions>> = {
  light: { dark: 0, diffuse: 0.6, mapBrightness: 2.4, mapBaseBrightness: 0 },
  dark: { dark: 1, diffuse: 1.4, mapBrightness: 7, mapBaseBrightness: 0.04 },
};

/** The globe's colours from the accent theme. */
function accentColors(accent: AccentPalette, tone: GlobeTone) {
  return (
    tone === "light"
      ? { baseColor: unit(accent.pale), markerColor: unit(accent.highlight), glowColor: unit(accent.lilac) }
      : { baseColor: unit(accent.deep), markerColor: unit(accent.highlight), glowColor: unit(accent.lavender) }
  ) satisfies Partial<COBEOptions>;
}

/** Idle spin in radians per second; a drag replaces it and eases back to it on release. */
const IDLE_SPIN = 0.3;
const THETA = 0.28;

export interface GlobeProps {
  className?: string;
  /** Overrides on top of the accent-driven defaults (cobe v2 options). */
  config?: Partial<COBEOptions>;
  /** Lets the visitor grab and throw the globe. */
  draggable?: boolean;
  /** Accessible name; the canvas is decorative when omitted. */
  label?: string;
  /** The ground it sits on. */
  tone?: GlobeTone;
}

/**
 * A dotted WebGL globe (cobe) coloured by the visitor's accent theme. It spins slowly, can be
 * grabbed and thrown, and only renders while it is on screen and the tab is visible. With reduced
 * motion it holds still until dragged.
 */
export function Globe({ className, config, draggable = true, label, tone = "light" }: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accent = useAccent();
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let size = Math.max(1, Math.round(wrap.clientWidth * dpr));

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size,
      height: size,
      phi: 0,
      theta: THETA,
      dark: 0,
      diffuse: 0.5,
      mapSamples: 16000,
      mapBrightness: 1.4,
      markers: [],
      ...TONES[tone],
      ...accentColors(accent, tone),
      ...configRef.current,
    });
    globeRef.current = globe;

    // Spin state: phi turns at `velocity`, which drifts back toward the idle spin.
    let phi = 0;
    let theta = THETA;
    let velocity = reduced ? 0 : IDLE_SPIN;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;

    let frame = 0;
    let prev = 0;
    let onScreen = false;
    const tick = (now: number) => {
      const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
      prev = now;
      if (!dragging) {
        const rest = reduced ? 0 : IDLE_SPIN;
        velocity += (rest - velocity) * Math.min(1, dt * 1.6);
        theta += (THETA - theta) * Math.min(1, dt * 2.5);
        phi += velocity * dt;
      }
      globe.update({ phi, theta, width: size, height: size });
      // Reduced motion: stop drawing once the globe has settled.
      if (reduced && !dragging && Math.abs(velocity) < 0.001 && Math.abs(theta - THETA) < 0.001) {
        frame = 0;
        prev = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      prev = 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(wrap);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(() => {
      size = Math.max(1, Math.round(wrap.clientWidth * dpr));
      globe.update({ width: size, height: size });
      start();
    });
    ro.observe(wrap);

    const onDown = (e: PointerEvent) => {
      if (!draggable) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.dataset.dragging = "";
      start();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const width = wrap.clientWidth || 1;
      const dx = ((e.clientX - lastX) / width) * Math.PI;
      const dy = ((e.clientY - lastY) / width) * Math.PI;
      const dt = Math.max((e.timeStamp - lastT) / 1000, 0.001);
      phi += dx;
      theta = Math.max(-0.9, Math.min(0.9, theta + dy));
      velocity = velocity * 0.4 + (dx / dt) * 0.6;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      // A throw keeps its speed, within reason; a still release eases back to the idle spin.
      velocity = Math.max(-8, Math.min(8, e.timeStamp - lastT > 80 ? 0 : velocity));
      delete canvas.dataset.dragging;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      start();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      globe.destroy();
      globeRef.current = null;
    };
    // The accent is applied by the effect below without rebuilding the globe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable, tone]);

  // Re-colour in place when the visitor switches accent.
  useEffect(() => {
    globeRef.current?.update({ ...accentColors(accent, tone), ...configRef.current });
  }, [accent, tone]);

  return (
    <div ref={wrapRef} className={cn("relative aspect-square w-full", className)}>
      <canvas
        ref={canvasRef}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn(
          "block size-full touch-none [contain:layout_paint_size]",
          draggable && "cursor-grab data-[dragging]:cursor-grabbing",
        )}
      />
    </div>
  );
}
