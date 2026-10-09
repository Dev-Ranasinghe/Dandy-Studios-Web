"use client";

import { useEffect, useRef } from "react";
import { hexToRgb255 } from "@/lib/accent";

const rgb = (hex: string) => hexToRgb255(hex).map((c) => c / 255);

/*
 * A two-colour ordered-dither texture over a slowly warping field, after Paper Shaders'
 * Dithering ("warp" shape, 4x4 Bayer), trimmed to what the tickets use. Small canvases only:
 * it draws at most 30fps, caps the pixel ratio, and stops while off screen or hidden.
 */

const VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_px;
uniform vec3 u_back;
uniform vec3 u_front;
uniform float u_seed;
out vec4 fragColor;

const int bayer4[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);

void main() {
  vec2 cell = floor(gl_FragCoord.xy / u_px);
  vec2 uv = (cell + 0.5) * u_px / u_resolution.y;
  uv = uv * 1.6 + u_seed;
  float t = u_time * 0.5;
  for (float i = 1.0; i < 6.0; i++) {
    uv.x += 0.6 / i * cos(i * 2.5 * uv.y + t);
    uv.y += 0.6 / i * cos(i * 1.5 * uv.x + t);
  }
  float shape = 0.15 / max(0.001, abs(sin(t - uv.y - uv.x)));
  shape = smoothstep(0.02, 1.0, shape);
  ivec2 p = ivec2(mod(cell, 4.0));
  float threshold = float(bayer4[p.y * 4 + p.x]) / 16.0;
  float lit = step(0.5, shape + threshold - 0.5);
  fragColor = vec4(mix(u_back, u_front, lit), 1.0);
}`;

type Props = {
  back: string;
  front: string;
  /** Dither cell in CSS px. */
  pixel?: number;
  /** Offsets the field so neighbouring tickets don't print the same pattern. */
  seed?: number;
  className?: string;
  /** Print once and hold still (e.g. under live glass, where any motion forces a refraction). */
  still?: boolean;
};

export default function DitherShader({ back, front, pixel = 2, seed = 0, className, still = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = useRef({ back, front });
  colors.current = { back, front };
  const repaint = useRef<() => void>(() => {});

  useEffect(() => repaint.current(), [back, front]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    // A lost context (GPU reset, too many contexts) hands back null objects: keep the CSS ground.
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
    const uBack = u("u_back");
    const uFront = u("u_front");
    gl.uniform1f(u("u_seed"), seed);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = 1;
    let time = seed * 3;
    let last = 0;
    let raf = 0;
    let onScreen = false;

    const draw = () => {
      gl.uniform3fv(uBack, rgb(colors.current.back));
      gl.uniform3fv(uFront, rgb(colors.current.front));
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uPx, Math.max(1, Math.round(pixel * dpr)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    repaint.current = () => {
      if (!raf) draw();
    };
    const resize = (w: number, h: number) => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last && now - last < 31) return;
      time += last ? Math.min((now - last) / 1000, 0.1) * 0.4 : 0;
      last = now;
      draw();
    };
    const sync = () => {
      const run = onScreen && !document.hidden && !reduce && !still;
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
      repaint.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      // No loseContext() here: React remounts effects on the same canvas (dev Strict Mode), and
      // a deliberately lost context would come back dead.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [pixel, seed, still]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
