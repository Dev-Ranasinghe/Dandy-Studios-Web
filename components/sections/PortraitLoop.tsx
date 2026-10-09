"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StatementSection.module.css";

// Rings travel outward from the figure through these colours, like a pulsing aura.
const AURA = ["#1b2a55", "#3d7bf2", "#f5a623", "#ffe36e", "#e8412c", "#2a1d4f", "#8f5cf7", "#1b2a55", "#46c2ff"];
const GROUND = "#6b3fd1";
const RING_GAP = 0.085; // ring spacing, as a share of the canvas size
const RING_SPEED = 0.05; // canvas widths per second the rings expand
const CUT_SECONDS = 2.6; // footage and aura alternate with a hard cut

// A standing figure in a 100x100 box (Path2D is built in the browser, not at import).
const FIGURE_PATH =
  "M50 38C42 38 38 41 37 47L35 62C35 65 38 65 38.5 62L41 51 42 64 43 82C43 85 47 85 47 82L49 66H51L53 82C53 85 57 85 57 82L58 64 59 51 61.5 62C62 65 65 65 65 62L63 47C62 41 58 38 50 38Z";

// Fixed confetti on the ground, so every frame of the loop matches.
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  x: ((i * 37) % 100) / 100,
  y: ((i * 61 + 13) % 100) / 100,
  angle: (i * 47) % 180,
  color: AURA[(i * 3) % AURA.length],
}));

/** Wobbly closed ring around the figure, taller than it is wide. */
function ringPath(ctx: CanvasRenderingContext2D, size: number, radius: number, t: number, seed: number) {
  ctx.beginPath();
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const wobble = 1 + 0.06 * Math.sin(3 * a + t * 1.6 + seed) + 0.035 * Math.sin(7 * a - t * 2.2 + seed * 2);
    const r = radius * wobble;
    const x = size / 2 + Math.cos(a) * r * 0.82;
    const y = size * 0.56 + Math.sin(a) * r * 1.12;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawAura(ctx: CanvasRenderingContext2D, figure: Path2D, size: number, t: number) {
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, size, size);

  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.018;
  for (const c of CONFETTI) {
    ctx.save();
    ctx.translate(c.x * size, c.y * size);
    ctx.rotate(((c.angle + t * 40) * Math.PI) / 180);
    ctx.strokeStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(-size * 0.02, 0);
    ctx.lineTo(size * 0.02, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Rings are born at the figure and grow outward; paint the largest first.
  const gap = RING_GAP * size;
  const travel = (t * RING_SPEED * size) % gap;
  const born = Math.floor((t * RING_SPEED * size) / gap);
  for (let n = 9; n >= 0; n--) {
    const radius = size * 0.14 + n * gap + travel;
    const index = born - n;
    const color = AURA[((index % AURA.length) + AURA.length) % AURA.length];
    ringPath(ctx, size, radius, t, index);
    ctx.fillStyle = color;
    ctx.fill();
    // Hand-drawn dashes riding each ring.
    ctx.setLineDash([size * 0.02, size * 0.045]);
    ctx.lineDashOffset = -t * size * 0.05;
    ctx.lineWidth = size * 0.012;
    ctx.strokeStyle = AURA[(((index + 3) % AURA.length) + AURA.length) % AURA.length];
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The figure breathes a little, and its heart glows red.
  const breathe = 1 + Math.sin(t * 2.4) * 0.02;
  ctx.save();
  ctx.translate(size / 2, size * 0.58);
  ctx.scale((size / 100) * 0.9 * breathe, (size / 100) * 0.9 * breathe);
  ctx.translate(-50, -60);
  ctx.fillStyle = "#07070a";
  ctx.fill(figure);
  ctx.beginPath();
  ctx.arc(50, 30, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8412c";
  ctx.beginPath();
  ctx.arc(51.5, 47, 1.6 + Math.max(0, Math.sin(t * 5)) * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The inline portrait: cuts between footage and a hand-drawn aura, like a motion reel. */
export default function PortraitLoop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<"footage" | "aura">("footage");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let visible = false;
    let elapsed = 0;
    let last = 0;
    let size = 0;
    const figure = new Path2D(FIGURE_PATH);

    const resize = () => {
      size = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio, 2));
      canvas.width = size;
      canvas.height = size;
    };

    const loop = (now: number) => {
      // A frame can be stamped slightly before `last` was read: never let time run backwards.
      elapsed += Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      const current = Math.floor(elapsed / CUT_SECONDS) % 2 === 0 ? "footage" : "aura";
      setScene(current);
      if (current === "aura" && size) drawAura(ctx, figure, size, elapsed);
      if (visible) frame = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);

    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {/* Swap in real footage at the same path; the poster covers load and reduced motion. */}
      <video
        src="/video/statement-portrait.mp4"
        poster="/video/statement-portrait-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <canvas ref={canvasRef} className={styles.aura} data-active={scene === "aura"} />
    </>
  );
}
