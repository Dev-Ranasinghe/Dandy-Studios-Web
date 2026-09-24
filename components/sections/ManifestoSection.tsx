"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import styles from "./ManifestoSection.module.css";

/*
 * A tunnel of type: four walls of words in CSS 3D, streaming toward the
 * viewer. Each wall's strip holds two identical sets, so shifting it by
 * exactly one set (50%) loops without a seam.
 */
const WALLS = [
  { side: "left", word: "Design", axis: "x", from: 0, to: -50 },
  { side: "right", word: "Build", axis: "x", from: -50, to: 0 },
  { side: "top", word: "Motion", axis: "y", from: 0, to: -50 },
  { side: "floor", word: "Type", axis: "y", from: -50, to: 0 },
] as const;

const ROWS = 10;
const MARQUEE_COPIES = 4;

/** Holds each pose for two frames at 24fps, like animation shot "on twos". */
function onTwos(ease: string, duration: number) {
  const base = gsap.parseEase(ease);
  const steps = Math.max(2, Math.round(duration * 12));
  return (p: number) => (p >= 1 ? 1 : base(Math.floor(p * steps) / steps));
}

function Burst() {
  const points = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const r = i % 2 === 0 ? 50 : 30;
    return `${Math.round(50 + Math.cos(a) * r)},${Math.round(50 + Math.sin(a) * r)}`;
  }).join(" ");
  return (
    <svg className={styles.glyph} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={points} />
    </svg>
  );
}

function WallSet({ word, axis }: { word: string; axis: "x" | "y" }) {
  if (axis === "x") return <span className={styles.set}>{`${word} ${word} `}</span>;
  return (
    <span className={styles.set}>
      {Array.from({ length: ROWS }, (_, i) => (
        <span key={i} className={styles.row}>
          {word}
        </span>
      ))}
    </span>
  );
}

export default function ManifestoSection() {
  const rootRef = useRef<HTMLElement>(null);
  const filterId = `ink-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    const q = (name: string) => root.querySelector<HTMLElement>(`[data-fx="${name}"]`)!;
    const qa = (name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-fx="${name}"]`));

    let mm: gsap.MatchMedia | undefined;
    let cancelled = false;

    document.fonts.ready.then(() => {
      if (cancelled) return;
      mm = gsap.matchMedia(root);

      mm.add(
        { full: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const { reduce } = ctx.conditions as { full: boolean; reduce: boolean };
          const stage = q("stage");
          const scene = q("scene");
          const card = q("card");

          if (reduce) {
            // Still tunnel, no streaming: content fades in place.
            gsap.from([stage, q("marquee"), card], {
              autoAlpha: 0,
              duration: 0.5,
              stagger: 0.1,
              scrollTrigger: { trigger: root, start: "top 75%", once: true },
            });
            return;
          }

          /* ---------- Ambient: streams, ink boil, scroll speed ---------- */

          const streams = qa("strip").map((strip) => {
            const axis = strip.dataset.axis === "y" ? "yPercent" : "xPercent";
            return gsap.fromTo(
              strip,
              { [axis]: Number(strip.dataset.from) },
              { [axis]: Number(strip.dataset.to), duration: 9, ease: "none", repeat: -1 },
            );
          });
          const marquee = gsap.fromTo(q("marquee-strip"), { xPercent: 0 }, { xPercent: -100 / MARQUEE_COPIES * 2, duration: 14, ease: "none", repeat: -1 });
          const loops = [...streams, marquee];

          // The ink edges re-roughen at 8fps: the turbulence seed changes on twos.
          const turbulence = root.querySelector("feTurbulence");
          const boil = gsap.to({}, {
            duration: 0.125,
            repeat: -1,
            onRepeat: () => turbulence?.setAttribute("seed", String(gsap.utils.random(1, 999, 1))),
          });

          // Scrolling pushes the tunnel and marquee; scrolling up runs them backwards.
          let settle: gsap.core.Tween | undefined;
          ScrollTrigger.create({
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => [...loops, boil].forEach((t) => (self.isActive ? t.play() : t.pause())),
            onUpdate: (self) => {
              const speed = gsap.utils.clamp(-5, 7, 1 + self.getVelocity() / 500);
              loops.forEach((t) => gsap.to(t, { timeScale: speed, duration: 0.3, overwrite: true }));
              settle?.kill();
              settle = gsap.delayedCall(0.2, () =>
                loops.forEach((t) => gsap.to(t, { timeScale: 1, duration: 0.8, ease: "power2.out", overwrite: true })),
              );
            },
          });

          // Look around inside the tunnel: the vanishing point follows the pointer.
          const look = { x: 50, y: 50 };
          const setLook = () => scene.style.setProperty("perspective-origin", `${look.x}% ${look.y}%`);
          const onMove = (event: PointerEvent) => {
            if (event.pointerType !== "mouse" && event.buttons === 0) return;
            const rect = stage.getBoundingClientRect();
            gsap.to(look, {
              x: 50 + ((event.clientX - rect.left) / rect.width - 0.5) * 50,
              y: 50 + ((event.clientY - rect.top) / rect.height - 0.5) * 50,
              duration: 0.6,
              ease: "power3.out",
              overwrite: true,
              onUpdate: setLook,
            });
          };
          const onLeave = () =>
            gsap.to(look, { x: 50, y: 50, duration: 0.9, ease: "power3.out", overwrite: true, onUpdate: setLook });
          stage.addEventListener("pointermove", onMove);
          stage.addEventListener("pointerdown", onMove);
          stage.addEventListener("pointerleave", onLeave);
          stage.addEventListener("pointerup", onLeave);
          stage.addEventListener("pointercancel", onLeave);

          /* ---------- Entrance ---------- */

          const heading = SplitText.create(q("heading"), { type: "words" });
          const body = SplitText.create(q("body"), { type: "lines", mask: "lines" });

          gsap
            .timeline({ scrollTrigger: { trigger: root, start: "top 70%", once: true } })
            // The tunnel punches in from its vanishing point.
            .from(scene, { scale: 0.35, rotation: -6, autoAlpha: 0, duration: 0.55, ease: onTwos("back.out(1.8)", 0.55) })
            // The base word slams up into frame, landing a little crooked, then settles.
            .from(q("base"), { yPercent: 100, rotation: -3, duration: 0.35, ease: onTwos("back.out(2.4)", 0.35) }, 0.25)
            // The band unrolls; the card slams down beside it.
            .from(q("marquee"), { scaleX: 0, transformOrigin: "0% 50%", duration: 0.4, ease: onTwos("power3.out", 0.4) }, 0.15)
            .from(card, { y: 60, rotation: 2, scale: 0.92, duration: 0.45, ease: onTwos("back.out(2)", 0.45) }, 0.3)
            .from(q("label"), { scale: 0, rotation: -12, duration: 0.25, ease: onTwos("back.out(3)", 0.25) }, 0.6)
            .from(
              heading.words,
              {
                scale: 0.2,
                rotation: "random(-12, 12)",
                autoAlpha: 0,
                transformOrigin: "50% 80%",
                duration: 0.24,
                ease: onTwos("back.out(3)", 0.24),
                stagger: 0.035,
              },
              0.7,
            )
            .from(body.lines, { yPercent: 105, duration: 0.7, ease: "expo.out", stagger: 0.05 }, 1.1)
            .call(() => {
              heading.revert();
              body.revert();
            });

          return () => {
            stage.removeEventListener("pointermove", onMove);
            stage.removeEventListener("pointerdown", onMove);
            stage.removeEventListener("pointerleave", onLeave);
            stage.removeEventListener("pointerup", onLeave);
            stage.removeEventListener("pointercancel", onLeave);
          };
        },
      );

      ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      mm?.revert();
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.wrap} aria-labelledby="manifesto-heading">
      {/* Roughens the base word's edges like ink bleeding into cheap paper. */}
      <svg className={styles.defs} aria-hidden="true">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
      </svg>

      <div
        className={styles.stage}
        data-fx="stage"
        role="img"
        aria-label="Animated type tunnel: design, build, motion and type streaming toward you, over the word Dandy"
      >
        <div className={styles.ink} aria-hidden="true">
          <div className={styles.scene} data-fx="scene">
            {WALLS.map((wall) => (
              <div key={wall.side} className={`${styles.wall} ${styles[wall.side]}`}>
                <div
                  className={`${styles.strip} ${wall.axis === "y" ? styles.stripY : ""}`}
                  data-fx="strip"
                  data-axis={wall.axis}
                  data-from={wall.from}
                  data-to={wall.to}
                >
                  <WallSet word={wall.word} axis={wall.axis} />
                  <WallSet word={wall.word} axis={wall.axis} />
                </div>
              </div>
            ))}
          </div>
          {/* Only the static word gets the ink filter; filtering the moving tunnel costs a full re-render per frame. */}
          {/* Stretched to the full frame width, like the word the reference's tunnel stands on. */}
          <svg className={styles.base} viewBox="0 0 100 24" style={{ filter: `url(#${filterId})` }} data-fx="base">
            <text x="0" y="23" textLength="100" lengthAdjust="spacingAndGlyphs">
              DANDY
            </text>
          </svg>
        </div>
      </div>

      <div className={styles.marquee} data-fx="marquee" aria-hidden="true">
        <div className={styles.marqueeStrip} data-fx="marquee-strip">
          {Array.from({ length: MARQUEE_COPIES }, (_, i) => (
            <span key={i} className={styles.marqueeItem}>
              <Burst />
              More dandy less organic
            </span>
          ))}
        </div>
      </div>

      <div className={styles.card} data-fx="card">
        <p className={styles.label} data-fx="label">
          What&rsquo;s this?
        </p>
        <h2 id="manifesto-heading" className={styles.heading} data-fx="heading">
          Brands, interfaces and websites, designed and built by the same pair of hands.
        </h2>
        <p className={styles.body} data-fx="body">
          Dandy Studios is a one-person design and development studio. I take a brand from first
          sketch to shipped site: the identity, the interface, the motion and the front-end code
          that holds it all together. No agency layers, no hand-off between designer and developer,
          no detail lost in a spec document. You talk to the person doing the work, and the work
          moves as fast as the conversation. If you have an idea that deserves more than a
          notebook, this is where it gets made.
        </p>
      </div>
    </section>
  );
}
