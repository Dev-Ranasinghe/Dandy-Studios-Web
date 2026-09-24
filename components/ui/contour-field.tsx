"use client";

import { useEffect, useRef } from "react";

interface ContourFieldProps {
  className?: string;
  /** Line colour; keep it faint, this is ground not figure. */
  color?: string;
  /** Number of contour levels drawn. */
  levels?: number;
  /** Grid cell size in CSS px; smaller is smoother and costlier. */
  cell?: number;
  /** Drift speed multiplier. */
  speed?: number;
}

/**
 * Topographic contour lines that slowly drift and reshape, drawn on a canvas with
 * marching squares over a warped sine field. Pauses off screen; static for reduced motion.
 */
export default function ContourField({
  className,
  color = "rgba(38, 44, 20, 0.16)",
  levels = 11,
  cell = 14,
  speed = 1,
}: ContourFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let cols = 0;
    let rows = 0;
    let field = new Float32Array(0);
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / cell) + 1;
      rows = Math.ceil(height / cell) + 1;
      field = new Float32Array(cols * rows);
    };

    // Smooth, organic field: sines whose phase is itself bent by other sines.
    const sample = (x: number, y: number, t: number) => {
      const u = x * 0.0021;
      const v = y * 0.0021;
      return (
        Math.sin(u * 2.1 + Math.sin(v * 1.7 + t * 0.9) * 1.6 + t * 0.35) +
        Math.sin(v * 2.4 + Math.sin(u * 1.3 - t * 0.6) * 1.4 - t * 0.25) +
        0.55 * Math.sin((u - v) * 3.1 + t * 0.4)
      );
    };

    const draw = (t: number) => {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          field[j * cols + i] = sample(i * cell, j * cell, t);
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let l = 0; l < levels; l++) {
        const iso = -2.2 + (4.4 * (l + 0.5)) / levels;
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = field[j * cols + i];
            const b = field[j * cols + i + 1];
            const c = field[(j + 1) * cols + i + 1];
            const d = field[(j + 1) * cols + i];
            const code = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
            if (code === 0 || code === 15) continue;

            const x = i * cell;
            const y = j * cell;
            // Edge crossings, linearly interpolated.
            const top = () => [x + cell * ((iso - a) / (b - a)), y];
            const right = () => [x + cell, y + cell * ((iso - b) / (c - b))];
            const bottom = () => [x + cell * ((iso - d) / (c - d)), y + cell];
            const left = () => [x, y + cell * ((iso - a) / (d - a))];
            const seg = (p: number[], q: number[]) => {
              ctx.moveTo(p[0], p[1]);
              ctx.lineTo(q[0], q[1]);
            };

            switch (code) {
              case 1: case 14: seg(left(), bottom()); break;
              case 2: case 13: seg(bottom(), right()); break;
              case 3: case 12: seg(left(), right()); break;
              case 4: case 11: seg(top(), right()); break;
              case 5: seg(left(), top()); seg(bottom(), right()); break;
              case 6: case 9: seg(top(), bottom()); break;
              case 7: case 8: seg(left(), top()); break;
              case 10: seg(left(), bottom()); seg(top(), right()); break;
            }
          }
        }
      }
      ctx.stroke();
    };

    resize();
    const start = performance.now();
    let frame = 0;
    let last = 0;
    let visible = false;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30fps is plenty for a slow drift
      last = now;
      draw(((now - start) / 1000) * 0.12 * speed);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible && !reduceMotion) frame = requestAnimationFrame(loop);
    });
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(((performance.now() - start) / 1000) * 0.12 * speed);
    });
    resizeObserver.observe(canvas);
    draw(0);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [color, levels, cell, speed]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
