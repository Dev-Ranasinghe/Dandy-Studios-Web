"use client";

import { useEffect, useRef } from "react";
import { useAccent } from "@/lib/accent";
import { createRenderBudget } from "@/lib/render-budget";

/*
 * "Metaballs": made with the 21st.dev Shader Builder.
 * Adapted from Paper Shaders: https://shaders.paper.design/metaballs
 * Licensed under Apache-2.0: https://github.com/paper-design/shaders
 *
 * A fullscreen triangle in a plain WebGL1 context, no libraries. The fragment shader is the
 * builder's, with three local departures:
 *   - Beans only: the shader writes alpha, so everything outside the blobs is transparent and the
 *     page shows through (no ground colour). The field's own level drives the alpha.
 *   - Colours follow the site's accent theme (plasma → lavender → highlight → pale), easing across
 *     when the visitor picks another.
 *   - More beans over a bigger field. Up to twelve beans (the recipe has seven; fewer on small
 *     canvases so they don't pour into one mass), and the orbit is
 *     its own uniform (u_orbit), stretched per axis to fill the canvas, instead of a fixed 0.63
 *     circle. The zoom now only sets bean size (a fixed size on screen), so the beans roam the
 *     whole band without growing.
 *   - Whole beans only. The orbit stops a measured margin short of every edge, so no bean is
 *     ever cut in half by the canvas.
 */

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
// "Metaballs" — made with the 21st.dev Shader Builder
// Adapted from Paper Shaders: https://shaders.paper.design/metaballs
// Licensed under Apache-2.0: https://github.com/paper-design/shaders

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[8];
uniform vec4 u_scene;      // resolution.xy, time, colour count
uniform vec4 u_shape;      // scale, intensity, paramA, warp
uniform vec4 u_surface;    // detail, contrast, brightness, saturation
uniform vec4 u_finish;     // hue, vignette, blur, grain
uniform vec4 u_transform;  // seed, rotation, drift, OKLab toggle
uniform vec4 u_space;      // offset.xy, pointer.xy
uniform vec4 u_cursor;
// Local: orbit radius x/y in field units, bean count. The 16th vector, WebGL1's guaranteed limit.
uniform vec4 u_orbit;

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x, 31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w

float hash21(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  float n = sin(dot(p, vec2(41.0, 289.0)));
  return fract(vec2(15731.743, 7892.321) * n);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, c));
}
vec3 linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 mixColour(vec3 a, vec3 b, float t) {
  if (u_oklab > 0.5) {
    vec3 la = linToOklab(srgbToLinear(a));
    vec3 lb = linToOklab(srgbToLinear(b));
    return clamp(linearToSrgb(oklabToLin(mix(la, lb, t))), 0.0, 1.0);
  }
  return mix(a, b, t);
}

vec3 palette(float x) {
  float n = max(u_colorCount - 1.0, 1.0);
  float f = clamp(x, 0.0, 1.0) * n;
  vec3 col = u_colors[0];
  for (int i = 0; i < 7; i++) {
    if (float(i) < n)
      col = mixColour(col, u_colors[i + 1],
        smoothstep(0.0, 1.0, clamp(f - float(i), 0.0, 1.0)));
  }
  return col;
}

vec3 hueRotate(vec3 col, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
                          0.587, -0.274, -0.523,
                          0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0,
                          0.956, -0.272, -1.106,
                          0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float ca = cos(a), sa = sin(a);
  yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  return toRGB * yiq;
}

// Local: the field level of the last shade() call, for the alpha (beans only, no ground).
float g_level = 0.0;

vec3 shade(vec2 uv, vec2 p, float t) {
  float field = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= u_orbit.z) break;
    vec2 center = vec2(sin(t * (0.19 + fi * 0.037) + fi * 2.1 + u_seed),
                       cos(t * (0.16 + fi * 0.043) + fi * 1.4)) * u_orbit.xy;
    field += (0.025 + u_intensity * 0.065) / (dot(p - center, p - center) + 0.006);
  }
  float surface = smoothstep(mix(1.8, 0.45, u_paramA), mix(2.3, 0.8, u_paramA), field);
  g_level = clamp(surface + field * 0.05, 0.0, 1.0);
  return palette(g_level);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 screenUv = uv;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);
  float cursorMask = 0.0;

  if (u_cursorPresence > 0.001) {
    vec2 cursor = (0.5 * u_mouse * u_resolution.xy)
      / min(u_resolution.x, u_resolution.y);
    vec2 cursorDelta = p - cursor;
    if (u_cursorEffect < 0.5) {
      p += cursor * u_cursorPresence * u_cursorStrength * 0.55;
    } else {
      float cursorDistance = length(cursorDelta);
      vec2 cursorDirection = cursorDelta / max(cursorDistance, 0.0001);
      cursorMask = u_cursorPresence
        * (1.0 - smoothstep(0.0, u_cursorRadius, cursorDistance));
      if (u_cursorEffect < 1.5) {
        p -= cursorDirection * cursorMask * u_cursorStrength * 0.24;
      } else if (u_cursorEffect < 2.5) {
        float cursorAngle = cursorMask * u_cursorStrength * 2.2;
        float cc = cos(cursorAngle), cs = sin(cursorAngle);
        p = cursor + mat2(cc, -cs, cs, cc) * cursorDelta;
      } else if (u_cursorEffect < 3.5) {
        float ripple = sin(
          cursorDistance / max(u_cursorRadius, 0.001) * 18.0 - u_time * 5.0);
        p -= cursorDirection * ripple * cursorMask * u_cursorStrength * 0.07;
      }
    }
  }

  uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
  p *= u_scale;
  if (abs(u_rotate) > 0.0001) {
    float cr = cos(u_rotate), sr = sin(u_rotate);
    p = mat2(cr, -sr, sr, cr) * p;
  }
  p += u_offset;
  if (u_drift > 0.0001)
    p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
  if (u_warp > 0.0) {
    p += u_warp * (vec2(
      fbm(p * u_detail + u_seed),
      fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);
  }
  vec3 col;
  if (u_blur > 0.0) {
    float e = u_blur;
    float pe = e * u_scale;
    vec2 uvE = vec2(e) * min(u_resolution.x, u_resolution.y) / u_resolution.xy;
    col  = shade(uv, p, u_time) * 0.36;
    col += shade(uv + vec2(uvE.x, 0.0), p + vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv - vec2(uvE.x, 0.0), p - vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv + vec2(0.0, uvE.y), p + vec2(0.0, pe), u_time) * 0.16;
    col += shade(uv - vec2(0.0, uvE.y), p - vec2(0.0, pe), u_time) * 0.16;
  } else {
    col = shade(uv, p, u_time);
  }
  if (abs(u_contrast - 1.0) > 0.0001)
    col = (col - 0.5) * u_contrast + 0.5;
  if (abs(u_saturation - 1.0) > 0.0001) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, u_saturation);
  }
  if (abs(u_hue) > 0.0001)
    col = hueRotate(col, u_hue);
  if (abs(u_brightness) > 0.0001)
    col += u_brightness;
  if (u_vignette > 0.0001) {
    float vd = length(screenUv - 0.5) * 1.41421356;
    col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);
  }
  if (u_cursorPresence > 0.001 && u_cursorEffect > 3.5)
    col += (vec3(0.18) + col * 0.12) * cursorMask * u_cursorStrength;
  // Local: beans only. Opaque from just outside the outer rim colour inward, so each bean ends on
  // its crisp rim, as in the recipe, with no dark glow left on the page; grain on the beans alone.
  float alpha = smoothstep(0.2, 0.3, g_level);
  if (u_grain > 0.0001)
    col += (grainHash(
      gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain * alpha;
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col * alpha, alpha); // premultiplied
}
`;

// Four colours, low → high. The recipe's were near-black, red, orange, cream; here they come
// from the accent theme in the same roles: deep glow edge, rim, body, bright core.
const COLOR_COUNT = 4;

// The recipe's packed values (see the builder's header comment).
const TIME_RATE = 0.57; // speed 25/100
/** Up to twelve beans (the loop's size); fewer on small canvases, one per this many bean areas. */
const MAX_BEANS = 12;
const MIN_BEANS = 5;
const AREA_PER_BEAN = 13;
/**
 * A single bean's body radius, as a share of the canvas's short side (the recipe's zoom draws it
 * near 0.13), within CSS px limits. Big enough that neighbours meet and pour into each other.
 */
const BEAN_SHARE = 0.12;
const BEAN_MIN_PX = 44;
const BEAN_MAX_PX = 104;
/** A bean's body radius in field units (threshold of the field for one bean at this intensity). */
const BEAN_FIELD_RADIUS = 0.166;
const SHAPE_REST = [0.35, 0.28, 0.0] as const; // intensity, paramA, warp
const SURFACE = [1.82, 1.0, 0.0, 1.0] as const;
const FINISH = [0.0, 0.0, 0.0, 0.04] as const; // grain 12/100
const TRANSFORM = [1.0, 0.0, 0.0, 0.0] as const;
const CURSOR = [0.0, 2.0, 0.65, 0.46] as const; // cursor off

/**
 * How far past its orbit a bean's rim ever reaches, in field units. Simulated over a long run
 * of the same field (twelve beans; wide, tall and square orbits) at the alpha's start: the rim
 * sits at most 0.36 beyond the orbit, so 0.38 keeps every bean whole.
 */
const ORBIT_MARGIN = 0.38;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type Props = {
  className?: string;
  style?: React.CSSProperties;
  /**
   * Fraction of the height, at top and at bottom, to keep clear (e.g. under a CSS fade). The
   * blobs are kept inside what's left, so nothing ever takes a slice off one.
   */
  fadeY?: number;
};

export default function MetaballsShader({ className, style, fadeY = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accent = useAccent();
  // The palette the loop eases toward; a theme change re-targets it.
  const targetRef = useRef<Float32Array>(new Float32Array(24));
  const nudgeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const target = new Float32Array(24);
    [accent.plasma, accent.lavender, accent.highlight, accent.pale].forEach((hex, i) => target.set(hexToRgb(hex), i * 3));
    targetRef.current = target;
    nudgeRef.current();
  }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!canvas || !gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error("Metaballs shader:", gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Metaballs program:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // One triangle that covers the viewport.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uColors = u("u_colors");
    const colors = Float32Array.from(targetRef.current);
    gl.uniform3fv(uColors, colors);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform4f(u("u_surface"), ...SURFACE);
    gl.uniform4f(u("u_finish"), ...FINISH);
    gl.uniform4f(u("u_transform"), ...TRANSFORM);
    gl.uniform4f(u("u_space"), 0, 0, 0, 0);
    gl.uniform4f(u("u_cursor"), ...CURSOR);
    const uScene = u("u_scene");
    const uShape = u("u_shape");
    const uOrbit = u("u_orbit");

    const budget = createRenderBudget();
    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = budget.scale(rect.width, rect.height);
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      // The zoom only sets bean size, from the short side, within px limits.
      const short = Math.min(width, height);
      const beanPx = Math.min(BEAN_MAX_PX, Math.max(BEAN_MIN_PX, (BEAN_SHARE * short) / dpr));
      const scale = (BEAN_FIELD_RADIUS * short) / (beanPx * dpr);
      // The orbit fills the canvas on each axis, stopping the glow's margin short of the edges
      // (and of any faded band), so the beans spread over the whole area and stay whole.
      const roomX = ((0.5 * width) / short) * scale;
      const roomY = (((0.5 - fadeY) * height) / short) * scale;
      gl.uniform4f(uShape, scale, ...SHAPE_REST);
      // As many beans as the area holds without them pouring into one mass.
      const beans = Math.round(
        Math.min(MAX_BEANS, Math.max(MIN_BEANS, (width * height) / (beanPx * dpr) ** 2 / AREA_PER_BEAN)),
      );
      gl.uniform4f(uOrbit, Math.max(0, roomX - ORBIT_MARGIN), Math.max(0, roomY - ORBIT_MARGIN), beans, 0);
      draw(lastTime, true);
    };

    let lastTime = 6; // a settled frame for reduced motion
    // Eases the palette toward the theme's, about as fast as the page's own 700ms change.
    const easeColors = (snap: boolean) => {
      const target = targetRef.current;
      let moved = false;
      for (let i = 0; i < 24; i++) {
        const d = target[i] - colors[i];
        if (Math.abs(d) > 0.001) {
          colors[i] = snap ? target[i] : colors[i] + d * 0.12;
          moved = true;
        }
      }
      if (moved) gl.uniform3fv(uColors, colors);
    };
    const draw = (seconds: number, snap = false) => {
      easeColors(snap);
      gl.uniform4f(uScene, width, height, seconds * TIME_RATE, COLOR_COUNT);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // A theme change while the loop is idle (off screen, reduced motion) redraws once, settled.
    nudgeRef.current = () => {
      if (!frame) draw(lastTime, true);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = false;
    let start = performance.now() - lastTime * 1000;
    const loop = (now: number) => {
      lastTime = (now - start) / 1000;
      draw(lastTime);
      if (budget.frame(now)) resize();
      frame = requestAnimationFrame(loop);
    };
    // Runs only while on screen and while the tab is showing; reduced motion gets one still frame.
    const sync = () => {
      const run = visible && !document.hidden && !reduce;
      if (run && !frame) {
        start = performance.now() - lastTime * 1000;
        budget.reset();
        frame = requestAnimationFrame(loop);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    resize();

    return () => {
      nudgeRef.current = () => {};
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [fadeY]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}
