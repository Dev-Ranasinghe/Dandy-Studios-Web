"use client";

import { useEffect, useRef } from "react";
import { hexToRgb255 } from "@/lib/accent";

/*
 * A rising tide of ordered dither, after Paper Shaders' Dithering ("wave" shape, 8x8 Bayer). The
 * front colour fills from the bottom up to `level` (0 = nothing, 1 = the whole canvas) under a
 * moving wave crest, dissolving into the back colour through the dither. The level is read from
 * a ref every frame, so a scroll timeline can drive it without re-rendering React.
 */

const VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_px;
uniform float u_level;
uniform vec3 u_back;
uniform vec3 u_front;
out vec4 fragColor;

const int bayer8[64] = int[64](
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21);

void main() {
  vec2 cell = floor(gl_FragCoord.xy / u_px);
  vec2 uv = (cell + 0.5) * u_px / u_resolution;
  float x = (uv.x - 0.5) * u_resolution.x / u_resolution.y * 4.0;
  float t = u_time;
  // Paper's wave crest.
  float wave = cos(0.5 * x - 2.0 * t) * sin(1.5 * x + t) * (0.75 + 0.25 * cos(3.0 * t));
  // The crest's height: below the canvas at level 0, past the top (band included) at level 1.
  float crest = mix(-0.45, 1.45, u_level) + wave * 0.11;
  float shape = 1.0 - smoothstep(crest - 0.42, crest, uv.y);
  ivec2 p = ivec2(mod(cell, 8.0));
  float threshold = float(bayer8[p.y * 8 + p.x]) / 64.0;
  float lit = step(0.5, shape + threshold - 0.5);
  fragColor = vec4(mix(u_back, u_front, lit), 1.0);
}`;

const rgb = (hex: string) => hexToRgb255(hex).map((c) => c / 255);

type Props = {
  back: string;
  /** Optional second ground the back colour moves to as `phase` goes 0 → 1. */
  backTo?: string;
  phase?: React.RefObject<number>;
  front: string;
  /** 0..1, read each frame. */
  level: React.RefObject<number>;
  /** 0..1 multiplier on the wave's motion, read each frame (0 = still). */
  motion?: React.RefObject<number>;
  /** Minimum ms between redraws, read each frame (default 31, about 30fps). */
  interval?: React.RefObject<number>;
  /** Dither cell in CSS px. */
  pixel?: number;
  speed?: number;
  className?: string;
};

export default function WaveDither({ back, backTo, phase, front, level, motion, interval, pixel = 3, speed = 0.6, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = useRef({ back, backTo: backTo ?? back, front, phase });
  colors.current = { back, backTo: backTo ?? back, front, phase };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!canvas || !gl || gl.isContextLost()) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(program, n);
    const uRes = u("u_resolution");
    const uTime = u("u_time");
    const uPx = u("u_px");
    const uLevel = u("u_level");
    const uBack = u("u_back");
    const uFront = u("u_front");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Cells are a few px wide, so device-pixel density adds nothing but cost.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let time = 0;
    let last = 0;
    let raf = 0;
    let onScreen = false;
    let lastKey = "";

    const draw = () => {
      const k = Math.min(1, Math.max(0, colors.current.phase?.current ?? 0));
      const b0 = rgb(colors.current.back);
      const b1 = rgb(colors.current.backTo);
      gl.uniform3fv(uBack, b0.map((c, i) => c + (b1[i] - c) * k));
      gl.uniform3fv(uFront, rgb(colors.current.front));
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uPx, Math.max(1, Math.round(pixel * dpr)));
      gl.uniform1f(uLevel, level.current ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const resize = (w: number, h: number) => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // A slow wave reads the same at 30fps, and every redraw makes the glass over it refract again.
      if (last && now - last < (interval?.current ?? 31)) return;
      const m = motion ? Math.max(0, motion.current ?? 1) : 1;
      if (!reduce) time += last ? Math.min((now - last) / 1000, 0.1) * speed * m : 0;
      last = now;
      // Skip the redraw when nothing moved: anything layered over the canvas (the tickets'
      // glass) then has nothing to re-render.
      const key = `${time.toFixed(4)}|${(level.current ?? 0).toFixed(4)}|${(colors.current.phase?.current ?? 0).toFixed(3)}|${colors.current.back}${colors.current.front}`;
      if (key === lastKey) return;
      lastKey = key;
      draw();
    };
    const sync = () => {
      const run = onScreen && !document.hidden;
      if (run && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const ro = new ResizeObserver(([e]) => resize(e.contentRect.width, e.contentRect.height));
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [pixel, speed, level, motion, interval]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
