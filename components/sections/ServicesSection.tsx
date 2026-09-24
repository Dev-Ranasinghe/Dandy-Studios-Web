"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import PlasmaShader, { renderPlasmaStills, type PlasmaSettings } from "@/components/ui/plasma-shader";
import styles from "./ServicesSection.module.css";

// Sampled from the reference: near-black violet, deep purple, dusty lavender, slate teal.
const BACKDROP = ["#1c0a2e", "#301250", "#4d3b78", "#2c5264"];

// Hue rotation and the saturation boost are zeroed so the palette lands as sampled.
const BACKDROP_SETTINGS: Partial<PlasmaSettings> = {
  surface: [1.34, 1.04, 0.03, 1.0],
  finish: [0, 0.18, 0.039, 0.01],
};

// Each service gets its own colour mood in the hover panel; the shader crossfades between them.
const SERVICES = [
  {
    title: "Brand identity",
    note: "Logos, type and a voice to match",
    colors: ["#12040c", "#ff2e97", "#ff9ccf", "#c6def8"],
  },
  {
    title: "Websites & web apps",
    note: "Designed and coded in one pass",
    colors: ["#050c24", "#1f4fd1", "#7fb2ff", "#e6f0ff"],
  },
  {
    title: "Motion & interaction",
    note: "Scroll, hover, WebGL and GSAP",
    colors: ["#14041f", "#7a1fff", "#ff2e97", "#ffd166"],
  },
  {
    title: "Design systems",
    note: "From tokens to shipped components",
    colors: ["#04140e", "#1f7a55", "#8ef0c1", "#f1fff8"],
  },
  {
    title: "Creative development",
    note: "Shaders, experiments, odd ideas",
    colors: ["#140a02", "#b85c00", "#ffb000", "#fff2c4"],
  },
  {
    title: "Launch campaigns",
    note: "Pages built for launch day",
    colors: ["#1a0606", "#c0262e", "#ff8a5b", "#ffe4d6"],
  },
];

// The panel runs the recipe as authored, minus the hue shift, so each mood keeps its colours.
const PANEL_SETTINGS: Partial<PlasmaSettings> = {
  finish: [0, 0.12, 0.039, 0.01],
};

const HIDDEN_CLIP = "inset(50% 50% 50% 50% round 24px)";

/** List + hover panel where a mouse can hover; stacked cards on touch and small screens. */
const LIST_QUERY = "(hover: hover) and (min-width: 1024px)";

export default function ServicesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"list" | "cards" | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pointerInList, setPointerInList] = useState(false);
  const [stills, setStills] = useState<string[]>([]);
  const reduceMotion = useReducedMotion();

  // The "Enquire" pill trails the cursor on springs rather than sticking to it.
  const pillX = useSpring(0, { stiffness: 380, damping: 32, mass: 0.6 });
  const pillY = useSpring(0, { stiffness: 380, damping: 32, mass: 0.6 });

  useEffect(() => {
    const mq = window.matchMedia(LIST_QUERY);
    const update = () => {
      setMode(mq.matches ? "list" : "cards");
      setActive(null);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Cards show still frames of each service's shader, rendered once from one context.
  // Generated in idle time, so the one-off render never lands on a scroll frame.
  useEffect(() => {
    if (mode !== "cards" || stills.length) return;
    const run = () => setStills(renderPlasmaStills(SERVICES.map((s) => s.colors), { width: 560, height: 328, settings: PANEL_SETTINGS }));
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 200);
    return () => clearTimeout(id);
  }, [mode, stills.length]);

  // Panel opens from its centre on the first hover and closes the same way.
  // Driven through one number: tweening clip-path strings directly breaks when
  // the browser normalises "inset(50% 50% 50% 50%)" to "inset(50%)".
  const reveal = useRef({ r: 0 });
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || mode !== "list") return;
    const open = active !== null;
    const apply = () => {
      const inset = 50 * (1 - reveal.current.r);
      panel.style.clipPath = `inset(${inset}% ${inset}% ${inset}% ${inset}% round 24px)`;
      panel.style.visibility = reveal.current.r > 0 ? "visible" : "hidden";
    };
    gsap.to(reveal.current, {
      r: open ? 1 : 0,
      duration: reduceMotion ? 0 : open ? 0.9 : 0.55,
      ease: open ? "expo.out" : "power3.inOut",
      overwrite: true,
      onUpdate: apply,
      onComplete: apply,
    });
  }, [active, mode, reduceMotion]);

  // Each change of row gives the panel a small push, so the swap reads as a cut.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || active === null || reduceMotion) return;
    gsap.fromTo(panel, { scale: 1.035 }, { scale: 1, duration: 0.9, ease: "expo.out" });
  }, [active, reduceMotion]);

  // Titles rise out of their masks as the section arrives.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !mode) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      if (reduceMotion) return;
      if (mode === "list") {
        gsap.from("[data-rise]", {
          yPercent: 105,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.07,
          scrollTrigger: { trigger: section, start: "top 65%", once: true },
        });
      } else {
        ScrollTrigger.batch("[data-card]", {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.from(batch, { y: 48, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.08 }),
        });
      }
      gsap.from("[data-intro]", {
        y: 24,
        autoAlpha: 0,
        duration: 0.9,
        ease: "expo.out",
        scrollTrigger: { trigger: section, start: "top 75%", once: true },
      });
    }, section);
    return () => ctx.revert();
  }, [mode, reduceMotion]);

  const onPointerMove = (event: React.PointerEvent) => {
    const rect = sectionRef.current!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // While the pill is hidden, jump it to the cursor so it never flies in from a corner.
    if (active === null) {
      pillX.jump(x);
      pillY.jump(y);
    } else {
      pillX.set(x);
      pillY.set(y);
    }
  };

  const listMode = mode === "list";
  const activeColors = SERVICES[active ?? 0].colors;

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      data-mode={mode ?? undefined}
      aria-labelledby="services-heading"
      onPointerMove={listMode ? onPointerMove : undefined}
    >
      <PlasmaShader colors={BACKDROP} settings={BACKDROP_SETTINGS} cursor className={styles.backdrop} />

      {listMode && (
        <div ref={panelRef} className={styles.panel} style={{ clipPath: HIDDEN_CLIP, visibility: "hidden" }} aria-hidden="true">
          <PlasmaShader colors={activeColors} settings={PANEL_SETTINGS} paused={active === null} className={styles.panelCanvas} />
          <div className={styles.panelShade} />
        </div>
      )}

      <div className={styles.inner}>
        <h2 id="services-heading" className={styles.srOnly}>
          Services
        </h2>
        <p className={styles.intro} data-intro>
          Everything a brand needs between the first sketch and launch day, designed and built in
          one place.
        </p>

        <ul
          className={styles.list}
          data-active={listMode && active !== null ? "" : undefined}
          onPointerEnter={() => setPointerInList(true)}
          onPointerLeave={() => {
            setPointerInList(false);
            setActive(null);
          }}
        >
          {SERVICES.map((service, i) => (
            <li key={service.title} className={styles.item} data-card>
              <motion.a
                href="/contact"
                className={styles.row}
                data-on={active === i ? "" : undefined}
                aria-label={`${service.title}: ${service.note}. Enquire about this service.`}
                onPointerEnter={listMode ? () => setActive(i) : undefined}
                onFocus={listMode ? () => setActive(i) : undefined}
                onBlur={listMode ? () => setActive(null) : undefined}
                whileTap={listMode || reduceMotion ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {mode === "cards" && stills[i] && (
                  <span className={styles.cardMedia} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
                    <img src={stills[i]} alt="" className={styles.cardImage} />
                  </span>
                )}
                <span className={styles.mask}>
                  <span className={styles.title} data-rise>
                    {service.title}
                  </span>
                </span>
                <span className={styles.note}>{service.note}</span>
              </motion.a>
            </li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {listMode && pointerInList && active !== null && (
          <motion.span
            className={styles.pill}
            style={{ x: pillX, y: pillY }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            aria-hidden="true"
          >
            Enquire
          </motion.span>
        )}
      </AnimatePresence>
    </section>
  );
}
