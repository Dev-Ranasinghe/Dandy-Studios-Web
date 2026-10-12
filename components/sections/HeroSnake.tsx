"use client";

import { useEffect, useRef } from "react";
import { drawSnake, geometry, type Geometry } from "@/components/sections/SnakeTrail";

// The logo's head, drawn pointing up in a 40-unit box with the neck at the origin.
const TONGUE_PATH = "M0 -30 V-38 M0 -38 C-1 -42 -4 -44 -5 -48 M0 -38 C1 -42 4 -44 5 -48";
const TONGUE_WIDTH = 2.4;
const NECK_R = 8.4;
const HEAD_PATH = "M0 4 C-9 2 -13 -8 -12 -16 C-11 -24 -5 -31 0 -32 C5 -31 11 -24 12 -16 C13 -8 9 2 0 4Z";

// Crawl speed in px/s, and the rest each snake takes off screen before it comes round again.
const SPEED = 84;
const REST_S = 2.4;
// Two snakes, half a lap apart, so one is always on screen. Each runs down its own line
// (share of the width), wide screens and portrait ones alike.
const LANES = { wide: [0.3, 0.74], tall: [0.26, 0.72] };

// The lit rim and the dark line outside it, in px past the shape's edge.
const RIM = 1.6;
const EDGE = 3.2;

type Props = {
  className?: string;
  /** Sets the colours: `--snake-fill` (the body, at `--snake-fill-alpha`), `--snake-rim` (its lit edge), `--snake-edge` (the dark line). */
  bodyClass?: string;
  /** The tube's softness: a blur of this share of the parent's font size. */
  blur?: number;
};

type Parts = { body: Path2D; neck: Path2D; head: Path2D; tongue: Path2D; tongueWidth: number };

/**
 * Two of the logo's snakes crawling up over the hero's headline, head first, on a loop. They
 * run only while the hero is on screen and the tab is visible. With reduced motion they lie
 * still across the screen.
 *
 * Drawn on a canvas: a see-through body with one lit rim and a thin dark line outside it, then
 * blurred as one. The blur means the snakes don't need the screen's full density, so the
 * canvas runs at about one device pixel per blur pixel. (They were SVG inside the headline's
 * CSS blur, which made the browser re-blur the whole screen-sized headline on every frame.)
 */
export default function HeroSnake({ className, bodyClass, blur = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Off-screen layers: the rim and line, and the solid body (faded as one, so the neck's overlap can't double up).
    const lines = document.createElement("canvas");
    const solid = document.createElement("canvas");
    const lctx = lines.getContext("2d")!;
    const sctx = solid.getContext("2d")!;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tonguePath = new Path2D(TONGUE_PATH);
    const headPath = new Path2D(HEAD_PATH);
    const neckPath = new Path2D();
    neckPath.arc(0, 0, NECK_R, 0, Math.PI * 2);

    let width = 0;
    let height = 0;
    let scale = 1;
    let soft = 0;
    let snakes: Geometry[] = [];
    const colors = { fill: "", rim: "", edge: "", alpha: 0.22 };

    // Custom properties may hold color-mix(); the canvas wants a resolved colour.
    const readColors = () => {
      const style = getComputedStyle(canvas);
      const resolve = (name: string) => {
        canvas.style.color = `var(${name})`;
        return getComputedStyle(canvas).color;
      };
      colors.fill = resolve("--snake-fill");
      colors.rim = resolve("--snake-rim");
      colors.edge = resolve("--snake-edge");
      canvas.style.color = "";
      colors.alpha = parseFloat(style.getPropertyValue("--snake-fill-alpha")) || 0.22;
    };

    const measure = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const fontSize = parseFloat(getComputedStyle(canvas.parentElement ?? canvas).fontSize) || 0;
      soft = fontSize * blur;
      // About one device pixel per blur pixel, never sharper than the screen or 1.5x.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      scale = soft > 0 ? Math.min(dpr, Math.max(0.5, 1.5 / soft)) : dpr;
      for (const c of [canvas, lines, solid]) {
        c.width = Math.max(1, Math.round(width * scale));
        c.height = Math.max(1, Math.round(height * scale));
      }
      const tall = height > width;
      snakes = (tall ? LANES.tall : LANES.wide).map((lane) => {
        const g = geometry(width, height);
        // On portrait screens the body slims to about a letter's stem.
        return { ...g, cx: width * lane, thick: tall ? g.thick * 0.66 : g.thick };
      });
      readColors();
    };
    measure();

    // Head positions in the rising frame: from below the foot to past the top, tail and all.
    const bounds = (g: Geometry) => ({ start: height + g.thick * 2, end: -g.length - g.thick * 3 });

    const partsOf = (g: Geometry, headY: number, tongue: number): Parts => {
      const { body, pose } = drawSnake(g, headY);
      const m = new DOMMatrix().translate(pose.x, pose.y).rotate(pose.angle).scale(pose.scale);
      // Head parts go in already transformed, so strokes keep their width in page px.
      const neck = new Path2D();
      neck.addPath(neckPath, m);
      const head = new Path2D();
      head.addPath(headPath, m);
      // The tongue flicks from its root (the bottom of the fork, at y -30).
      const t = new Path2D();
      t.addPath(tonguePath, m.translate(0, -30).scale(1, tongue).translate(0, 30));
      return { body: new Path2D(body), neck, head, tongue: t, tongueWidth: TONGUE_WIDTH * pose.scale };
    };

    const fillParts = (c: CanvasRenderingContext2D, p: Parts) => {
      c.fill(p.body);
      c.fill(p.neck);
      c.fill(p.head);
      c.lineWidth = p.tongueWidth;
      c.stroke(p.tongue);
    };
    const strokeParts = (c: CanvasRenderingContext2D, p: Parts, extra: number) => {
      c.lineWidth = extra;
      c.stroke(p.body);
      c.stroke(p.neck);
      c.stroke(p.head);
      c.lineWidth = p.tongueWidth + extra;
      c.stroke(p.tongue);
    };

    const render = (drawn: Parts[]) => {
      for (const c of [ctx, lctx, sctx]) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = "source-over";
        c.globalAlpha = 1;
        c.filter = "none";
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.setTransform(scale, 0, 0, scale, 0, 0);
        c.lineJoin = "round";
        c.lineCap = "round";
      }
      if (!drawn.length) return;

      // The dark line, then the lit rim, as wide strokes of the whole shape; then the shape cut
      // out of them, so only the parts outside it remain (seamless where head meets body).
      lctx.strokeStyle = colors.edge;
      for (const p of drawn) strokeParts(lctx, p, EDGE * 2);
      lctx.strokeStyle = colors.rim;
      for (const p of drawn) strokeParts(lctx, p, RIM * 2);
      lctx.globalCompositeOperation = "destination-out";
      lctx.fillStyle = lctx.strokeStyle = "#000";
      for (const p of drawn) fillParts(lctx, p);

      sctx.fillStyle = sctx.strokeStyle = colors.fill;
      for (const p of drawn) fillParts(sctx, p);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (soft > 0) ctx.filter = `blur(${(soft * scale).toFixed(2)}px)`;
      ctx.drawImage(lines, 0, 0);
      ctx.globalAlpha = colors.alpha;
      ctx.drawImage(solid, 0, 0);
    };

    // A theme switch eases the colours over 700ms (registered properties on <html>, globals.css),
    // so they are re-read every frame until the ease is done.
    let recolorUntil = 0;
    let onTheme = () => {};
    const themeWatch = new MutationObserver(() => {
      recolorUntil = performance.now() + 800;
      readColors();
      onTheme();
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent", "class", "style"] });

    if (reduce) {
      const still = () => render(snakes.map((g, i) => partsOf(g, height * (i ? 0.42 : 0.04), 0.7)));
      still();
      // Reduced motion has no colour ease, so one read on the switch is enough.
      onTheme = still;
      const ro = new ResizeObserver(() => {
        measure();
        still();
      });
      ro.observe(canvas);
      return () => {
        ro.disconnect();
        themeWatch.disconnect();
      };
    }

    // Distance along the lap; the second snake runs half a lap behind the first, and the first
    // starts with its head already in the type, so the first viewport shows it.
    const lap = (g: Geometry) => {
      const { start, end } = bounds(g);
      return start - end + SPEED * REST_S;
    };
    let travelled = (height + snakes[0].thick * 2) * 0.45;
    let time = 0;
    let last = 0;
    let frame = 0;
    let visible = false;

    const loop = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      time += dt;
      travelled += SPEED * dt;
      if (now < recolorUntil) readColors();
      const drawn: Parts[] = [];
      snakes.forEach((g, i) => {
        const L = lap(g);
        const d = (((travelled + (i * L) / 2) % L) + L) % L;
        const { start, end } = bounds(g);
        const headY = start - d;
        const tongue = 0.7 + 0.3 * Math.max(0, Math.sin(time * 3.1 + i * 1.7)) ** 6;
        if (headY > end) drawn.push(partsOf(g, headY, tongue));
      });
      render(drawn);
      frame = requestAnimationFrame(loop);
    };

    const run = () => {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden) {
        // The theme may have changed while the loop slept.
        readColors();
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      run();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", run);
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      themeWatch.disconnect();
      document.removeEventListener("visibilitychange", run);
      cancelAnimationFrame(frame);
    };
  }, [blur]);

  return <canvas ref={canvasRef} className={[className, bodyClass].filter(Boolean).join(" ")} aria-hidden="true" />;
}
