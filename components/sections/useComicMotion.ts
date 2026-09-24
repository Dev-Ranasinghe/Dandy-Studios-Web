"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import type { HalftoneControl } from "@/components/ui/halftone-photo";

type Prints = {
  intro: RefObject<HalftoneControl | null>;
  about: RefObject<HalftoneControl | null>;
};

/**
 * Holds each pose for two frames at 24fps, like hand-drawn animation shot
 * "on twos". Wraps any GSAP ease; the curve stays, the in-betweens go.
 */
function onTwos(ease: string, duration: number) {
  const base = gsap.parseEase(ease);
  const steps = Math.max(2, Math.round(duration * 12));
  return (p: number) => (p >= 1 ? 1 : base(Math.floor(p * steps) / steps));
}

/**
 * Line boil: inked shapes jitter a pixel at 8fps so they read as redrawn
 * every frame. Starts once the entrance finishes; pauses off screen.
 */
function boil(targets: Element[]) {
  return gsap.to(targets, {
    x: "random(-1.2, 1.2)",
    y: "random(-1.2, 1.2)",
    rotation: "random(-1.6, 1.6)",
    duration: 0.125,
    ease: "steps(1)",
    repeat: -1,
    repeatRefresh: true,
    paused: true,
  });
}

/**
 * The print's grain re-dithers at 4fps, so the photo boils like the linework.
 * Each redraw is main-thread work, so it stays slow enough never to crowd a scroll frame.
 */
function printBoil(control: RefObject<HalftoneControl | null>) {
  return gsap.to(
    {},
    {
      duration: 0.25,
      repeat: -1,
      paused: true,
      onRepeat: () => control.current?.setDevelop(gsap.utils.random(-0.04, 0.04)),
    },
  );
}

/** A throb for impact shapes: two poses, held, back and forth. */
function throb(target: Element) {
  return gsap.to(target, { scale: 1.1, duration: 0.5, ease: "steps(2)", repeat: -1, yoyo: true, paused: true });
}

/**
 * Runs ambient loops only after the entrance has finished and only while the
 * trigger is on screen. Returns the function that marks the entrance done.
 */
function whileVisible(trigger: Element, loops: gsap.core.Tween[]) {
  let started = false;
  let visible = false;
  const sync = () => loops.forEach((loop) => (started && visible ? loop.play() : loop.pause()));
  ScrollTrigger.create({
    trigger,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => {
      visible = self.isActive;
      sync();
    },
  });
  return () => {
    started = true;
    sync();
  };
}

/** Panel shake on impact, like a frame jolted by a sound effect. */
function shake(target: Element, strength = 7) {
  return gsap.to(target, {
    keyframes: { x: [-strength, strength * 0.8, -strength * 0.5, strength * 0.25, 0], ease: "none" },
    duration: 0.28,
    ease: "steps(5)",
  });
}

/**
 * Motion smear: type leans against the scroll direction in proportion to
 * scroll speed, then snaps upright when scrolling stops.
 */
function smear(targets: Element[], trigger: Element) {
  const setters = targets.map((t) => gsap.quickTo(t, "skewX", { duration: 0.45, ease: "power3.out" }));
  let settle: gsap.core.Tween | undefined;
  ScrollTrigger.create({
    trigger,
    start: "top bottom",
    end: "bottom top",
    onUpdate: (self) => {
      const skew = gsap.utils.clamp(-9, 9, self.getVelocity() / -260);
      setters.forEach((set) => set(skew));
      settle?.kill();
      settle = gsap.delayedCall(0.12, () => setters.forEach((set) => set(0)));
    },
  });
}

/** Photos drift against the scroll, so the panel reads as layered. */
function drift(target: Element, trigger: Element, distance: number) {
  gsap.fromTo(
    target,
    { y: distance },
    {
      y: -distance,
      ease: "none",
      scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: 0.6 },
    },
  );
}

function develop(control: RefObject<HalftoneControl | null>, duration: number, ease: gsap.EaseFunction | string) {
  const state = { v: 1 };
  return gsap.to(state, {
    v: 0,
    duration,
    ease,
    onStart: () => control.current?.setDevelop(1),
    onUpdate: () => control.current?.setDevelop(state.v),
  });
}

const q = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-fx="${name}"]`);
const qa = (root: Element, name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-fx="${name}"]`));

export function useComicMotion(rootRef: RefObject<HTMLElement | null>, prints: Prints) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

    let mm: gsap.MatchMedia | undefined;
    let cancelled = false;

    // Split only after the display faces load, or lines and chars measure wrong.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      mm = gsap.matchMedia(root);

      mm.add(
        { full: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const { reduce } = ctx.conditions as { full: boolean; reduce: boolean };
          const intro = q(root, "intro")!;
          const about = q(root, "about")!;
          const counts = qa(intro, "count");

          // Prints start as blank paper and are inked in by the timelines.
          prints.intro.current?.setDevelop(1);
          prints.about.current?.setDevelop(1);

          const introTl = gsap.timeline({
            scrollTrigger: { trigger: intro, start: "top 72%", once: true },
          });
          const aboutTl = gsap.timeline({
            scrollTrigger: { trigger: about, start: "top 72%", once: true },
          });

          if (reduce) {
            // Gentle path: content fades in place, prints still develop, nothing moves.
            const fade = { autoAlpha: 0, duration: 0.5, ease: "power1.out", stagger: 0.08 };
            introTl
              .from([q(intro, "title"), q(intro, "lede"), q(intro, "link"), q(intro, "stats")], fade)
              .add(develop(prints.intro, 0.6, "power1.out"), 0);
            aboutTl
              .from([q(about, "lead"), q(about, "columns"), q(about, "aside"), q(about, "values")], fade)
              .add(develop(prints.about, 0.6, "power1.out"), 0);
            return;
          }


          /* ---------- Intro: the splash page ---------- */

          // Kept split after the entrance: the letters stay live for hover and tap.
          const display = SplitText.create(q(intro, "display")!, { type: "words,chars" });
          const subline = SplitText.create(q(intro, "subline")!, { type: "words" });
          const lede = SplitText.create(q(intro, "lede")!, { type: "lines", mask: "lines" });
          const speed = qa(intro, "speed");
          const speedlines = q(intro, "speedlines")!;
          const burst = q(intro, "burst")!;
          const startIntroLife = whileVisible(intro, [
            boil([q(intro, "chip")!, burst, q(intro, "hint")!, ...qa(intro, "stat")]),
            throb(q(intro, "burst-shape")!),
            printBoil(prints.intro),
          ]);

          const fireSpeedlines = () =>
            gsap
              .timeline()
              .set(speedlines, { autoAlpha: 1 })
              .fromTo(
                speed,
                { drawSVG: "0% 0%" },
                { drawSVG: "0% 100%", duration: 0.25, ease: "power2.out", stagger: { each: 0.006, from: "random" } },
              )
              .to(speed, { drawSVG: "100% 100%", duration: 0.3, ease: "power2.in", stagger: { each: 0.006, from: "random" } }, 0.38)
              .set(speedlines, { autoAlpha: 0 });

          // A letter hops and tilts, held on twos; ignored while it's mid-hop.
          const hop = (char: Element) => {
            if (gsap.isTweening(char)) return;
            gsap.to(char, {
              keyframes: { yPercent: [0, -24, 0], rotation: [0, gsap.utils.random(-12, 12), 0] },
              duration: 0.4,
              ease: "steps(5)",
            });
          };

          introTl
            // Panel slams into frame.
            .from(intro, {
              scale: 0.93,
              rotation: -1.4,
              y: 48,
              duration: 0.5,
              ease: onTwos("back.out(2.2)", 0.5),
            })
            // Speed lines whoosh out from the headline, then retract past it.
            .add(fireSpeedlines(), 0.12)
            // Letters slam down one at a time, each landing slightly askew.
            .from(
              display.chars,
              {
                scale: 3.2,
                yPercent: -60,
                rotation: "random(-18, 18)",
                autoAlpha: 0,
                duration: 0.34,
                ease: onTwos("back.out(2.6)", 0.34),
                stagger: 0.045,
              },
              0.18,
            )
            .from(
              subline.words,
              { scale: 0, rotation: "random(-10, 10)", duration: 0.26, ease: onTwos("back.out(3)", 0.26), stagger: 0.07 },
              "-=0.1",
            )
            // The tag stamps down; a starburst pops behind it and the panel jolts.
            .from(q(intro, "chip"), { scale: 2.6, rotation: -14, autoAlpha: 0, duration: 0.22, ease: onTwos("power4.in", 0.22) })
            .from(burst, { scale: 0, rotation: -40, duration: 0.4, ease: onTwos("back.out(3.2)", 0.4) })
            .add(shake(intro), "<")
            // The photo prints in from blank paper while its frame pops.
            .from(
              q(intro, "media"),
              { scale: 0.86, rotation: 2.5, duration: 0.45, ease: onTwos("back.out(2)", 0.45) },
              0.3,
            )
            .add(develop(prints.intro, 1.1, onTwos("power2.out", 1.1)), 0.4)
            // Body copy stays smooth: reading is never held for the effect.
            .from(lede.lines, { yPercent: 105, duration: 0.7, ease: "expo.out", stagger: 0.06 }, 1.15)
            .from(q(intro, "link"), { scale: 0, rotation: -8, duration: 0.3, ease: onTwos("back.out(3)", 0.3) }, 1.45)
            // Stats stamp in left to right while their numbers count up.
            .from(
              qa(intro, "stat"),
              { scale: 1.9, rotation: "random(-12, 12)", autoAlpha: 0, duration: 0.24, ease: onTwos("power4.in", 0.24), stagger: 0.14 },
              1.5,
            )
            .from(
              counts,
              { textContent: 0, snap: { textContent: 1 }, duration: 0.9, ease: onTwos("power2.out", 0.9), stagger: 0.14 },
              1.55,
            )
            .from(q(intro, "hint"), { scale: 0, rotation: 30, duration: 0.4, ease: onTwos("back.out(3.5)", 0.4) }, 1.9)
            .call(() => {
              subline.revert();
              lede.revert();
              startIntroLife();
              smear([q(intro, "display")!], intro);
            });

          drift(q(intro, "media")!, intro, 28);

          // Mouse: letters hop as the pointer crosses them. Tap or click the
          // headline: a wave runs through it, the speed lines fire, the panel jolts.
          const title = q(intro, "title")!;
          const onEnter = (event: PointerEvent) => {
            if (event.pointerType === "mouse" && introTl.progress() === 1) hop(event.currentTarget as Element);
          };
          let waving = false;
          const onTap = () => {
            if (waving || introTl.progress() < 1) return;
            waving = true;
            display.chars.forEach((char, i) => gsap.delayedCall(i * 0.035, () => hop(char)));
            fireSpeedlines();
            shake(intro, 5);
            gsap.delayedCall(0.8, () => (waving = false));
          };
          display.chars.forEach((char) => char.addEventListener("pointerenter", onEnter as EventListener));
          title.addEventListener("click", onTap);

          /* ---------- About: the next panel ---------- */

          const lead = SplitText.create(q(about, "lead")!, { type: "words" });
          const columns = SplitText.create(qa(about, "copy"), { type: "lines", mask: "lines" });
          const aside = SplitText.create(q(about, "aside-copy")!, { type: "lines", mask: "lines" });
          const stickers = qa(about, "sticker");
          const startAboutLife = whileVisible(about, [boil(stickers), printBoil(prints.about)]);
          drift(q(about, "cutout")!, about, 36);

          aboutTl
            .from(about, {
              scale: 0.93,
              rotation: 1.4,
              y: 48,
              duration: 0.5,
              ease: onTwos("back.out(2.2)", 0.5),
            })
            // Hand-lettered balloon text: words pop in as if inked one by one.
            .from(
              lead.words,
              {
                scale: 0.2,
                rotation: "random(-12, 12)",
                autoAlpha: 0,
                transformOrigin: "50% 80%",
                duration: 0.24,
                ease: onTwos("back.out(3)", 0.24),
                stagger: 0.028,
              },
              0.15,
            )
            .add(develop(prints.about, 1.1, onTwos("power2.out", 1.1)), 0.3)
            .from(columns.lines, { yPercent: 105, duration: 0.7, ease: "expo.out", stagger: 0.04 }, 0.8)
            .from(q(about, "rule"), { scaleX: 0, transformOrigin: "0 50%", duration: 0.4, ease: onTwos("power3.out", 0.4) }, 1.1)
            .from(aside.lines, { yPercent: 105, duration: 0.7, ease: "expo.out", stagger: 0.05 }, 1.2)
            // Stickers slap onto the print, each one jolting the panel.
            .from(
              stickers,
              {
                scale: 3,
                rotation: "random(-40, 40)",
                autoAlpha: 0,
                duration: 0.22,
                ease: onTwos("power4.in", 0.22),
                stagger: {
                  each: 0.2,
                  onComplete: () => {
                    shake(about, 4);
                  },
                },
              },
              1.0,
            )
            .call(() => {
              lead.revert();
              columns.revert();
              aside.revert();
              startAboutLife();
              smear([q(about, "lead")!], about);
            });

          return () => {
            display.chars.forEach((char) => char.removeEventListener("pointerenter", onEnter as EventListener));
            title.removeEventListener("click", onTap);
          };
        },
      );

      ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      mm?.revert();
    };
  }, [rootRef, prints.intro, prints.about]);
}
