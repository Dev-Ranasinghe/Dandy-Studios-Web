"use client"

import * as React from "react"
import { createRenderBudget } from "@/lib/render-budget"

type Pt = { x: number; y: number }

export type ZeroScore = {
  score: number
  sweep: number
  roundness: number
  closure: number
  cx: number
  cy: number
  r: number
  ok: boolean
}

// #region scorer
const MIN_RADIUS = 28

export function scoreZero(points: Pt[], tolerance: number): ZeroScore {
  const empty = { score: 0, sweep: 0, roundness: 0, closure: 0, cx: 0, cy: 0, r: 0, ok: false }
  if (points.length < 12) return empty

  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  const cx = sx / points.length
  const cy = sy / points.length

  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy))
  let rsum = 0
  for (const d of radii) rsum += d
  const r = rsum / radii.length
  if (r < MIN_RADIUS) return { ...empty, cx, cy, r }

  let varsum = 0
  for (const d of radii) varsum += (d - r) * (d - r)
  const roundness = 1 - Math.min(Math.sqrt(varsum / radii.length) / r, 1)

  // Signed angle swept around the centroid. Points near the centre carry no
  // reliable direction, so they reset the accumulator; a step over a quarter
  // turn means the stroke jumped rather than looped, so it is discarded.
  let swept = 0
  let prev: number | null = null
  for (let i = 0; i < points.length; i++) {
    if (radii[i] < r * 0.2) {
      prev = null
      continue
    }
    const a = Math.atan2(points[i].y - cy, points[i].x - cx)
    if (prev !== null) {
      let d = a - prev
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      if (Math.abs(d) < Math.PI / 2) swept += d
    }
    prev = a
  }
  const sweep = Math.abs(swept) / (Math.PI * 2)

  const last = points[points.length - 1]
  const gap = Math.hypot(points[0].x - last.x, points[0].y - last.y)
  const closure = 1 - Math.min(gap / (r * 2), 1)

  const score = roundness * 0.5 + Math.min(sweep, 1) * 0.3 + closure * 0.2
  return { score, sweep, roundness, closure, cx, cy, r, ok: score >= tolerance && sweep >= 0.75 }
}
// #endregion

/* ---------------------------------------------------------------- shaders */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

/* Ping-ponged heat buffer. R = how melted this texel is, 0 frozen, 1 open. */
const MELT_FS = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform vec2 uA;
uniform vec2 uB;
uniform float uDown;
uniform float uBrush;
uniform float uDecay;
uniform float uAspect;
out vec4 o;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float heat = texture(uPrev, uv).r * uDecay;
  if (uDown > 0.5) {
    vec2 sc = vec2(uAspect, 1.0);
    float d = segDist(uv * sc, uA * sc, uB * sc);
    heat = max(heat, 1.0 - smoothstep(uBrush * 0.2, uBrush, d));
  }
  o = vec4(heat, 0.0, 0.0, 1.0);
}`

const NOISE = `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

// Ridged noise. abs() folds the field about its midline, and the fold itself is
// a LINE. That is the whole trick: plain fbm can only ever make blobs, so no
// amount of thresholding it will produce a crack.
float ridged(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * (1.0 - abs(noise(p) * 2.0 - 1.0));
    p = p * 2.13 + vec2(7.7, 2.9);
    a *= 0.5;
  }
  return v;
}

// Voronoi F2 - F1: near zero exactly where two cells meet, so it draws the
// polygonal boundaries a real sheet of ice fractures along.
float cellEdge(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      float d = length(g + hash2(n + g) - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return f2 - f1;
}
`

/*
 * The ice's fixed detail (crack plates, shards, filaments and the noise that never moves), baked
 * once per size. It used to be recomputed for every pixel on every frame, which held the loader at
 * ~15fps on a laptop GPU. R = how far the cracks whiten the ice, G = the fine warp octave,
 * B = the wipe front's noise.
 */
const ICE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uAspect;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 sp = vec2(uv.x * uAspect, uv.y);
  float warpC = fbm(sp * 3.0) * 0.55;

  // Cracks have to be SPARSE. An even Voronoi net at full strength reads as
  // cellular skin, not ice; real ice is mostly clear with fracture running in
  // patches, so a low-frequency mask decides where any of it shows at all.
  float where = smoothstep(0.34, 0.72, fbm(sp * 2.1 + 11.3));
  float plates = (1.0 - smoothstep(0.0, 0.018, cellEdge(sp * 4.2 + warpC))) * where;
  float shards = (1.0 - smoothstep(0.0, 0.028, cellEdge(sp * 9.5 - warpC * 0.7)))
               * (1.0 - where) * 0.7;
  float fil = pow(ridged(sp * 30.0), 5.0);
  // Three mixes toward white in a row are one mix by the combined amount.
  float white = 1.0 - (1.0 - plates * 0.5) * (1.0 - shards * 0.22) * (1.0 - fil * 0.5);
  o = vec4(white, fbm(sp * 40.0), fbm(sp * 7.0), 1.0);
}`

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uHeat;
uniform vec2 uRes;
uniform float uTime;
uniform float uWipe;
uniform float uFlash;
uniform float uOpen;
uniform vec3 uZero;
uniform float uAspect;
uniform vec3 uBase;
uniform vec3 uFrost;
uniform vec3 uMelt;
uniform vec3 uGlow;
uniform vec3 uFlashCol;
uniform sampler2D uIce;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 sp = vec2(uv.x * uAspect, uv.y);
  float t = uTime;

  /* ------------------------------------------------------------------ ice */
  vec4 fixedIce = texture(uIce, uv);
  float caustic = fbm(sp * 9.0 + vec2(t * 0.035, t * 0.025));
  float web = pow(ridged(sp * 8.0 + vec2(t * 0.02, 0.0)), 2.0);

  // Broad soft light bands first, hard lines (baked, see ICE_FS) on top of them.
  vec3 ice = mix(uFrost * 0.62, uFrost * 1.06, caustic);
  ice = mix(ice, uFrost * 1.22, web * 0.55);
  ice = mix(ice, vec3(1.0), fixedIce.r);
  ice *= 0.86 + 0.28 * caustic;

  vec3 base = uBase * (0.82 + 0.35 * uv.y);

  /* ---------------------------------------------------------- sheet wipe */
  // GLSL smoothstep is undefined when edge0 > edge1, so every ramp here runs
  // low-to-high and is inverted explicitly where it needs to fall off.
  float front = uWipe * 1.25 - 0.12 + fixedIce.b * 0.12;
  float depth = 1.0 - uv.y;
  float sheet = 1.0 - smoothstep(front - 0.05, front + 0.05, depth);
  vec3 surface = mix(base, ice, sheet);

  /* ---------------------------------------------------------------- melt */
  float heat = texture(uHeat, uv).r;
  // Frequencies matter more than amplitudes: the low octave has to be around
  // the brush width, or it slides the whole boundary instead of lobing it.
  // Three octaves, and the top one matters most: it has to be fine enough to
  // fray the boundary itself. Low octaves only slide the whole edge around.
  // Everything the warp feeds is gated on heat (touched) or the opening, so untouched ice
  // skips it: before the first stroke that is the whole sheet, and most of the frame's cost.
  float warp = 0.0;
  if (heat > 0.008 || uOpen > 0.001) {
    warp = fbm(sp * 7.0 + t * 0.03) * 0.42
         + fbm(sp * 18.0 - t * 0.05) * 0.26
         + fixedIce.g * 0.16;
  }
  // Keep the raw field: the hole and its rim need different, WIDER bands of it.
  // Deriving the rim from the already-thresholded hole is what made it a
  // 3px outline instead of the soft cloud that sells the ice as melting.
  float hw = heat + warp - 0.42;
  float m = smoothstep(0.30, 0.58, hw);

  /* ------------------------------------------------------------- opening */
  // Once a zero is accepted the hole grows out of the ring that was drawn.
  // Cross-fading the whole frame to white instead throws away the one moment
  // the interaction is actually paying off.
  float dz = length((uv - uZero.xy) * vec2(uAspect, 1.0));
  float grow = 0.0;
  if (uOpen > 0.001) {
    float radius = uZero.z * (0.92 + uOpen * uOpen * 2.2);
    float edge = 0.03 + uOpen * 0.10;
    float g = 1.0 - smoothstep(radius - edge, radius + edge, dz);
    // Heavier warp against a narrower band: the front lobes and frays instead
    // of expanding as a clean circle.
    grow = smoothstep(0.40, 0.60, g + warp * 0.78 - 0.39);
  }
  float mm = max(m, grow);

  // hw is zero-mean away from the stroke, so a rim band this wide would light
  // up anywhere the warp noise peaks. Gate it on heat actually being present.
  float touched = smoothstep(0.008, 0.22, heat);
  float rim = smoothstep(-0.03, 0.30, hw) * (1.0 - smoothstep(0.34, 0.74, hw)) * touched;
  rim = max(rim, smoothstep(0.15, 0.55, grow) * (1.0 - smoothstep(0.55, 0.95, grow)));

  // Half-melted ice keeps a wet tint before it opens; fully melted is a HOLE,
  // and the page behind the canvas is what shows through it.
  vec3 col = mix(surface, mix(surface, uMelt, 0.6), smoothstep(0.0, 0.6, mm) * touched * sheet);
  col += uGlow * rim * sheet * 2.7;

  // Only what the pointer melted is a HOLE. The opening is not a bigger hole:
  // it is light pouring out of the ring, which is why it fills rather than
  // reveals. Driving alpha down with it made the page show through instead.
  float a = 1.0 - smoothstep(0.40, 0.66, hw) * touched * sheet;

  if (uOpen > 0.001) {
    col = mix(col, uFlashCol, grow * 0.94);
    a = max(a, grow * 0.97);
    float core = (1.0 - smoothstep(0.0, uZero.z * 1.6, dz)) * uOpen;
    col = mix(col, uFlashCol, core * 0.85);
    a = max(a, core * 0.95);
  }

  col = mix(col, uFlashCol, uFlash);
  a = max(a, uFlash);
  o = vec4(col, a);
}`

/* ------------------------------------------------------------------ style */

const styles = `
.zmp-root {
  --zmp-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --zmp-ease-io: cubic-bezier(0.77, 0, 0.175, 1);
  cursor: grab;
}
.zmp-root[data-status="drawing"] { cursor: grabbing; }
.zmp-root[data-status="open"] { cursor: auto; }
.zmp-hud {
  transition: opacity 260ms var(--zmp-ease-out), transform 260ms var(--zmp-ease-out);
}
.zmp-hud[data-hide="true"] { opacity: 0; transform: scale(0.98); }
.zmp-hud[data-hide="dim"] { opacity: 0.28; }
.zmp-hud[data-shake="true"] { animation: zmp-shake 320ms var(--zmp-ease-out); }
.zmp-veil {
  transition: opacity 620ms var(--zmp-ease-io);
}
.zmp-reward {
  animation: zmp-pop 620ms var(--zmp-ease-out) both;
}
.zmp-spark {
  animation: zmp-spark 900ms var(--zmp-ease-out) both;
}
.zmp-enter { transition: transform 160ms var(--zmp-ease-out); }
.zmp-enter:active { transform: scale(0.97); }
@keyframes zmp-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
@keyframes zmp-pop {
  from { opacity: 0; transform: translateY(6px) scale(0.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes zmp-spark {
  0% { opacity: 0; transform: scale(0.4) rotate(-25deg); }
  45% { opacity: 1; transform: scale(1.15) rotate(0deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
@media (prefers-reduced-motion: reduce) {
  .zmp-hud, .zmp-veil { transition-duration: 1ms; }
  .zmp-hud[data-shake="true"], .zmp-reward, .zmp-spark { animation: none; }
}
`

/* --------------------------------------------------------------- gl helper */

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed")
  }
  return sh
}

function program(gl: WebGL2RenderingContext, fs: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "program link failed")
  }
  return p
}

function target(gl: WebGL2RenderingContext, w: number, h: number) {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  return { tex, fbo }
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/* ------------------------------------------------------------------ props */

export type ZeroMeltPreloaderProps = {
  children?: React.ReactNode
  /** Headline on the gate. */
  prompt?: string
  /** Line under the headline. */
  hint?: string
  /** Line shown after a stroke that was not round enough. */
  /** Big mark in the bottom-left corner once the ice has landed. */
  wordmark?: string
  retryHint?: string
  /** 0-1. Higher demands a rounder, better-closed circle. */
  tolerance?: number
  /** Melt brush radius, as a fraction of the surface height. */
  brush?: number
  /** Ms for the ice sheet to wipe in while the counter runs down. */
  loadMs?: number
  /** Reward line shown after the blowout. Empty string hides it. */
  reward?: string
  /** Deep water behind the ice. */
  baseColor?: string
  /** The frozen sheet. */
  frostColor?: string
  /** What melting reveals. */
  meltColor?: string
  /** Rim light at the melt front. */
  glowColor?: string
  /** The light that floods out of an accepted ring, and the flash it ends on. */
  flashColor?: string
  onUnlock?: () => void
  className?: string
}

type Status = "loading" | "idle" | "drawing" | "fail" | "unlocking" | "reward" | "open"

export default function ZeroMeltPreloader({
  children,
  prompt = "Draw a zero",
  hint = "Trace a full circle to melt your way in",
  wordmark = "zero",
  retryHint = "Not quite — one closed circle",
  tolerance = 0.6,
  brush = 0.075,
  loadMs = 1800,
  reward = "+100 XP",
  baseColor = "#1d6b52",
  frostColor = "#9fd8c0",
  meltColor = "#48c257",
  glowColor = "#eafff4",
  flashColor = "#ffffff",
  onUnlock,
  className = "",
}: ZeroMeltPreloaderProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const ptsRef = React.useRef<Pt[]>([])
  const rectRef = React.useRef<DOMRect | null>(null)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])

  // Written by events, read by the render loop. Never triggers a re-render.
  const live = React.useRef({
    down: false,
    a: [0.5, 0.5] as [number, number],
    b: [0.5, 0.5] as [number, number],
    decay: 1,
    flash: 0,
    open: 0,
    zero: [0.5, 0.5, 0.15] as [number, number, number],
    brushK: 1,
    start: 0,
  })

  const [status, setStatus] = React.useState<Status>("loading")
  const [count, setCount] = React.useState(99)
  const [failed, setFailed] = React.useState(false)
  const [noGl, setNoGl] = React.useState(false)
  const [veilGone, setVeilGone] = React.useState(true)
  const [ink, setInk] = React.useState("")

  const statusRef = React.useRef(status)
  statusRef.current = status

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }

  /* ----------------------------------------------------------- gl lifecycle */

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", {
      // The melt is a real hole: the canvas goes transparent where the ice is
      // gone and the children underneath show through it.
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
    })
    if (!gl) {
      setNoGl(true)
      return
    }

    let meltProg: WebGLProgram
    let showProg: WebGLProgram
    let iceProg: WebGLProgram
    try {
      meltProg = program(gl, MELT_FS)
      showProg = program(gl, DISPLAY_FS)
      iceProg = program(gl, ICE_FS)
    } catch {
      setNoGl(true)
      return
    }

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    // Half-resolution heat buffer (at 1.5x DPR): the melt front is soft, nobody
    // can see the difference, and it halves the fill cost on every frame.
    let buffers: ReturnType<typeof target>[] = []
    let ice: ReturnType<typeof target> | null = null
    // Full density only while the GPU keeps up; a slow one gets softer ice, not a stuttering gate.
    const budget = createRenderBudget({ maxDpr: 1.5, maxPixels: 1_400_000, minQuality: 0.5 })
    let bw = 0
    let bh = 0
    let src = 0
    let raf = 0
    const t0 = performance.now()
    live.current.start = t0

    const resize = () => {
      const scale = budget.scale(canvas.clientWidth, canvas.clientHeight)
      const w = Math.max(1, Math.round(canvas.clientWidth * scale))
      const h = Math.max(1, Math.round(canvas.clientHeight * scale))
      // buffers.length matters: on a remount the canvas is already the right
      // size, and bailing here would leave the render loop with no targets.
      if (canvas.width === w && canvas.height === h && buffers.length) return
      canvas.width = w
      canvas.height = h
      // The heat buffer is read by uv, so it only rebuilds when the layout changes. A budget step
      // (same CSS size, fewer pixels) keeps it, and with it whatever the visitor has melted.
      const nw = Math.max(1, Math.round(canvas.clientWidth * 0.75))
      const nh = Math.max(1, Math.round(canvas.clientHeight * 0.75))
      if (nw !== bw || nh !== bh || !buffers.length) {
        for (const b of buffers) {
          gl.deleteTexture(b.tex)
          gl.deleteFramebuffer(b.fbo)
        }
        buffers = [target(gl, nw, nh), target(gl, nw, nh)]
        bw = nw
        bh = nh
        for (const b of buffers) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo)
          gl.clearColor(0, 0, 0, 1)
          gl.clear(gl.COLOR_BUFFER_BIT)
        }
      }

      // Bake the ice's fixed detail at the new size.
      if (ice) {
        gl.deleteTexture(ice.tex)
        gl.deleteFramebuffer(ice.fbo)
      }
      ice = target(gl, w, h)
      gl.viewport(0, 0, w, h)
      gl.useProgram(iceProg)
      gl.uniform2f(gl.getUniformLocation(iceProg, "uRes"), w, h)
      gl.uniform1f(gl.getUniformLocation(iceProg, "uAspect"), w / h)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)
    const mu = {
      prev: u(meltProg, "uPrev"),
      res: u(meltProg, "uRes"),
      a: u(meltProg, "uA"),
      b: u(meltProg, "uB"),
      down: u(meltProg, "uDown"),
      brush: u(meltProg, "uBrush"),
      decay: u(meltProg, "uDecay"),
      aspect: u(meltProg, "uAspect"),
    }
    const su = {
      heat: u(showProg, "uHeat"),
      res: u(showProg, "uRes"),
      time: u(showProg, "uTime"),
      wipe: u(showProg, "uWipe"),
      flash: u(showProg, "uFlash"),
      open: u(showProg, "uOpen"),
      zero: u(showProg, "uZero"),
      aspect: u(showProg, "uAspect"),
      base: u(showProg, "uBase"),
      frost: u(showProg, "uFrost"),
      melt: u(showProg, "uMelt"),
      glow: u(showProg, "uGlow"),
      flashCol: u(showProg, "uFlashCol"),
      ice: u(showProg, "uIce"),
    }

    const cBase = hexToRgb(baseColor)
    const cFrost = hexToRgb(frostColor)
    const cMelt = hexToRgb(meltColor)
    const cGlow = hexToRgb(glowColor)
    const cFlash = hexToRgb(flashColor)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!buffers.length || !ice) return
      if (budget.frame(now)) resize()
      const L = live.current
      const aspect = canvas.width / Math.max(canvas.height, 1)

      // Melt pass into the spare buffer.
      const dst = buffers[1 - src]
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
      gl.viewport(0, 0, bw, bh)
      gl.useProgram(meltProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, buffers[src].tex)
      gl.uniform1i(mu.prev, 0)
      gl.uniform2f(mu.res, bw, bh)
      gl.uniform2f(mu.a, L.a[0], L.a[1])
      gl.uniform2f(mu.b, L.b[0], L.b[1])
      gl.uniform1f(mu.down, L.down ? 1 : 0)
      gl.uniform1f(mu.brush, brush * L.brushK)
      gl.uniform1f(mu.decay, L.decay)
      gl.uniform1f(mu.aspect, aspect)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      src = 1 - src
      L.a = L.b

      // Display pass to the screen.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(showProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, buffers[src].tex)
      gl.uniform1i(su.heat, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, ice.tex)
      gl.uniform1i(su.ice, 1)
      gl.uniform2f(su.res, canvas.width, canvas.height)
      gl.uniform1f(su.time, (now - t0) / 1000)
      gl.uniform1f(su.wipe, Math.min((now - L.start) / Math.max(loadMs, 1), 1))
      gl.uniform1f(su.flash, L.flash)
      gl.uniform1f(su.open, L.open)
      gl.uniform3f(su.zero, L.zero[0], L.zero[1], L.zero[2])
      gl.uniform1f(su.aspect, aspect)
      gl.uniform3fv(su.base, cBase)
      gl.uniform3fv(su.frost, cFrost)
      gl.uniform3fv(su.melt, cMelt)
      gl.uniform3fv(su.glow, cGlow)
      gl.uniform3fv(su.flashCol, cFlash)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const b of buffers) {
        gl.deleteTexture(b.tex)
        gl.deleteFramebuffer(b.fbo)
      }
      gl.deleteProgram(meltProg)
      gl.deleteProgram(showProg)
      gl.deleteProgram(iceProg)
      if (ice) {
        gl.deleteTexture(ice.tex)
        gl.deleteFramebuffer(ice.fbo)
      }
      gl.deleteVertexArray(vao)
    }
  }, [baseColor, frostColor, meltColor, glowColor, flashColor, brush, loadMs])

  /* -------------------------------------------------------------- countdown */

  React.useEffect(() => {
    if (status !== "loading") return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min((now - t0) / Math.max(loadMs, 1), 1)
      setCount(Math.round(99 * (1 - p)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setStatus("idle")
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, loadMs])

  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  /* ---------------------------------------------------------------- pointer */

  const uvOf = (e: React.PointerEvent) => {
    const r = rectRef.current
    if (!r) return null
    // GL samples bottom-up, the DOM measures top-down.
    return {
      px: e.clientX - r.left,
      py: e.clientY - r.top,
      u: (e.clientX - r.left) / r.width,
      v: 1 - (e.clientY - r.top) / r.height,
    }
  }

  const push = (e: React.PointerEvent) => {
    const c = uvOf(e)
    const r = rectRef.current
    if (!c || !r) return
    const pts = ptsRef.current
    const prev = pts[pts.length - 1]
    if (prev && Math.hypot(c.px - prev.x, c.py - prev.y) < 3) return
    // A brush that dwells melts wide, a flicked one melts thin. Constant width
    // is what made the stroke read as a vector capsule instead of a burn.
    if (prev) {
      const speed = Math.hypot(c.px - prev.x, c.py - prev.y) / Math.max(r.height, 1)
      const k = 1.18 - Math.min(speed / 0.03, 1) * 0.62
      live.current.brushK += (k - live.current.brushK) * 0.35
    }
    pts.push({ x: c.px, y: c.py })
    live.current.b = [c.u, c.v]
    if (noGl) setInk((d) => (pts.length === 1 ? "M " : d + " L ") + c.px + " " + c.py)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status === "unlocking" || status === "open" || status === "loading") return
    timers.current.forEach(clearTimeout)
    timers.current = []
    e.currentTarget.setPointerCapture(e.pointerId)
    rectRef.current = rootRef.current ? rootRef.current.getBoundingClientRect() : null
    ptsRef.current = []
    setInk("")
    setFailed(false)
    const c = uvOf(e)
    if (c) {
      live.current.a = [c.u, c.v]
      live.current.b = [c.u, c.v]
    }
    live.current.decay = 1
    live.current.brushK = 1
    live.current.open = 0
    live.current.down = true
    setVeilGone(false)
    setStatus("drawing")
    push(e)
  }

  const finish = () => {
    if (statusRef.current !== "drawing") return
    live.current.down = false
    const s = scoreZero(ptsRef.current, tolerance)

    if (!s.ok) {
      setStatus("fail")
      setFailed(true)
      live.current.decay = 0.93 // the sheet refreezes over the failed stroke
      later(() => {
        live.current.decay = 1
        ptsRef.current = []
        setInk("")
        setStatus("idle")
      }, 700)
      return
    }

    setStatus("unlocking")
    const r = rectRef.current
    const h = r ? r.height : 1
    const w = r ? r.width : 1
    // Shader space is bottom-up and distances are measured in screen heights.
    live.current.zero = [s.cx / w, 1 - s.cy / h, s.r / h]

    const t0 = performance.now()
    live.current.decay = 1
    const OPEN_MS = 620
    const FLASH_MS = 260
    const step = (now: number) => {
      const e = now - t0
      // The hole grows out of the drawn ring and floods with light first; the
      // white only takes over once that has actually been seen.
      const o = Math.min(e / OPEN_MS, 1)
      live.current.open = 1 - (1 - o) * (1 - o)
      const f = Math.min(Math.max(e - OPEN_MS, 0) / FLASH_MS, 1)
      live.current.flash = f * f
      if (e < OPEN_MS + FLASH_MS) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)

    // The white has to HOLD while the reward reads. Fading it and the reward
    // together means nobody ever sees the payoff.
    const lit = OPEN_MS + FLASH_MS + 40
    // Without a reward the handover happens in the same task the gate closes
    // in, so a host that covers the screen from onUnlock never drops a frame.
    later(() => {
      setStatus(reward ? "reward" : "open")
      if (!reward && onUnlock) onUnlock()
    }, lit)
    if (reward) {
      later(() => {
        setStatus("open")
        if (onUnlock) onUnlock()
      }, lit + 1100)
    }
  }

  const skip = () => {
    if (status === "unlocking" || status === "open") return
    setStatus("unlocking")
    live.current.open = 1
    live.current.flash = 1
    later(() => {
      setStatus("open")
      if (onUnlock) onUnlock()
    }, 260)
  }

  const open = status === "open"
  const gated = status !== "open" && status !== "reward"
  const hudHide = status === "unlocking" ? "true" : status === "drawing" ? "dim" : "false"

  return (
    <>
      <style>{styles}</style>
      <div
        ref={rootRef}
        data-status={status}
        className={
          "zmp-root relative isolate h-full w-full select-none overflow-hidden bg-background text-foreground " +
          className
        }
      >
        <div className="absolute inset-0 z-0">{children}</div>

        {gated && (
          <div
            className="absolute inset-0 z-10"
            style={{ touchAction: "none", backgroundColor: noGl ? baseColor : undefined }}
            onPointerDown={onPointerDown}
            onPointerMove={(e) => {
              if (status === "drawing") push(e)
            }}
            onPointerUp={finish}
            onPointerCancel={finish}
            aria-hidden="true"
          >
            <canvas ref={canvasRef} className="block h-full w-full" />

            {noGl && (
              <svg className="absolute inset-0 h-full w-full" fill="none">
                <path
                  d={ink}
                  stroke={glowColor}
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              </svg>
            )}

            {/* Two slots, as in the reference. Bottom-left holds the big white
                mark: the counter while loading, the wordmark once ice lands.
                The instruction sits small and centred, out of the way of it. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-8 sm:p-12">
              <span
                className="zmp-mark block text-7xl font-bold leading-[0.8] tracking-tight text-white/95 sm:text-8xl"
                style={{ textShadow: "0 2px 30px rgba(0,0,0,0.18)" }}
              >
                {status === "loading" ? count : wordmark}
              </span>
            </div>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              {status !== "loading" && (
                <>
                  <p
                    className="zmp-hud text-[11px] font-medium uppercase tracking-[0.3em] text-black/45"
                    data-hide={hudHide}
                    data-shake={String(status === "fail")}
                  >
                    {prompt}
                  </p>
                  {(failed || hint) && (
                    <p
                      className="zmp-hud text-[10px] uppercase tracking-[0.2em] text-black/30"
                      data-hide={hudHide}
                      data-shake={String(status === "fail")}
                    >
                      {failed ? retryHint : hint}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* The shader owns the blowout; this only takes over once the canvas has
            already reached white, to HOLD it while the reward reads. Mounting it
            at "unlocking" instead covers the flood and the bloom entirely. */}
        {!veilGone && !gated && (
          <div
            className="zmp-veil pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white"
            style={{ opacity: open ? 0 : 1 }}
            onTransitionEnd={() => open && setVeilGone(true)}
          >
            {(status === "reward" || open) && reward && (
              <>
                <svg viewBox="0 0 24 24" className="zmp-spark h-10 w-10" aria-hidden="true">
                  <path
                    d="M12 1.5l2.2 6.1 6.3 2.4-6.3 2.4L12 18.5l-2.2-6.1L3.5 10l6.3-2.4z"
                    fill="#f5c518"
                  />
                </svg>
                <span className="zmp-reward text-sm font-medium tracking-wide text-neutral-400">
                  {reward}
                </span>
              </>
            )}
          </div>
        )}

        {gated && (
          <button
            type="button"
            onClick={skip}
            className="zmp-enter sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-8 focus-visible:left-1/2 focus-visible:z-30 focus-visible:-translate-x-1/2 focus-visible:rounded-full focus-visible:border focus-visible:border-white/30 focus-visible:bg-black/40 focus-visible:px-5 focus-visible:py-2 focus-visible:text-sm focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Skip and enter
          </button>
        )}
      </div>
    </>
  )
}
