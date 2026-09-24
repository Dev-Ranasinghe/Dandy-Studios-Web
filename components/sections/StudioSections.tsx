"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HalftonePhoto, { type HalftoneControl } from "@/components/ui/halftone-photo";
import portrait from "@/public/images/portrait.jpg";
import cutout from "@/public/images/portrait-cutout.webp";
import { useComicMotion } from "./useComicMotion";
import styles from "./StudioSections.module.css";

// PLACEHOLDER: replace with the studio's real numbers before launch.
const STATS = [
  { value: 5, label: "Years designing & building" },
  { value: 40, label: "Projects shipped" },
  { value: 20, label: "Brands launched" },
];

const VALUES = ["Impact", "Clarity", "Craft"];

// Rounded so server and browser trig agree to the digit (avoids a hydration mismatch).
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Comic speed lines radiating from the headline; lengths and weights vary like hand inking. */
const SPEED_LINES = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2 + ((i * 7) % 5) * 0.03;
  const inner = 44 + ((i * 13) % 9);
  const outer = 96 + ((i * 5) % 4);
  return {
    x1: r2(Math.cos(angle) * inner),
    y1: r2(Math.sin(angle) * inner),
    x2: r2(Math.cos(angle) * outer),
    y2: r2(Math.sin(angle) * outer),
    width: 1.5 + ((i * 11) % 4) * 0.75,
  };
});

/** Jagged starburst outline, the classic comic impact shape. */
const BURST_POINTS = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2;
  const r = i % 2 === 0 ? 50 : 34 + ((i * 7) % 3) * 3;
  return `${(50 + Math.cos(angle) * r).toFixed(1)},${(50 + Math.sin(angle) * r).toFixed(1)}`;
}).join(" ");

function IntroSection({ print }: { print: React.RefObject<HalftoneControl | null> }) {
  const [exposed, setExposed] = useState(false);

  return (
    <section
      className={`${styles.panel} ${styles.intro}`}
      aria-labelledby="intro-heading"
      data-fx="intro"
    >
      <h2 id="intro-heading" className={styles.title} data-fx="title">
        <svg className={styles.speedlines} viewBox="-100 -100 200 200" aria-hidden="true" data-fx="speedlines">
          {SPEED_LINES.map((line, i) => (
            <line
              key={i}
              {...line}
              strokeWidth={line.width}
              vectorEffect="non-scaling-stroke"
              data-fx="speed"
            />
          ))}
        </svg>
        <span className={styles.display} data-fx="display">
          Ideas deserve
        </span>
        <span className={styles.subline}>
          <span data-fx="subline">better than a</span>
          <span className={styles.chipWrap}>
            {/* HTML wrappers carry the motion; the SVG only draws, so GSAP never fights its layout. */}
            <span className={styles.burst} aria-hidden="true" data-fx="burst">
              <span className={styles.burstShape} data-fx="burst-shape">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points={BURST_POINTS} vectorEffect="non-scaling-stroke" />
                </svg>
              </span>
            </span>
            <span className={styles.chip} data-fx="chip">
              notebook
            </span>
          </span>
        </span>
      </h2>

      <div className={styles.media} data-fx="media">
        <HalftonePhoto
          src={portrait}
          alt=""
          focus={[0.5, 0.42]}
          zoom={1.15}
          interactive
          controlRef={print}
          onInteract={() => setExposed(true)}
          className={styles.canvas}
        />
        <span className={styles.hint} data-hidden={exposed} aria-hidden="true" data-fx="hint">
          Drag to expose
        </span>
      </div>

      <p className={`${styles.body} ${styles.lede}`} data-fx="lede">
        Most good ideas never leave the sketchbook. They wait for the right time, the right
        budget, the right look. Dandy Studios closes that gap: one person who designs it and
        builds it, so the thing in your head becomes a site people can actually use. Sharp,
        fast, and unmistakably yours.
      </p>

      <a className={styles.link} href="/contact" data-fx="link">
        Start a project
      </a>

      <dl className={styles.stats} data-fx="stats">
        {STATS.map((stat) => (
          <div className={styles.stat} key={stat.label} data-fx="stat">
            <dt className={styles.statLabel}>{stat.label}</dt>
            <dd className={styles.statValue}>
              <span data-fx="count">{stat.value}</span>+
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AboutSection({ print }: { print: React.RefObject<HalftoneControl | null> }) {
  const figureRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  return (
    <section className={`${styles.panel} ${styles.about}`} aria-label="About the studio" data-fx="about">
      <p className={styles.lead} data-fx="lead">
        I&rsquo;m a designer who builds. My work sits between visual identity, interface design
        and front-end code: one process, no hand-offs, nothing lost in translation.
      </p>

      <div ref={figureRef} className={styles.figure}>
        <div className={styles.cutout} data-fx="cutout">
          <HalftonePhoto
            src={cutout}
            alt="Portrait of the founder of Dandy Studios holding a red rose in his teeth"
            focus={[0.5, 0.55]}
            interactive
            controlRef={print}
            className={styles.canvas}
          />
        </div>

        {/* Stickers can be peeled off and moved around the print, by mouse or finger. */}
        <ul className={styles.values} aria-label="Values" data-fx="values">
          {VALUES.map((value) => (
            <motion.li
              key={value}
              className={styles.stickerSlot}
              drag={!reduceMotion}
              dragConstraints={figureRef}
              dragElastic={0.15}
              dragTransition={{ bounceStiffness: 500, bounceDamping: 24 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              whileDrag={{ scale: 1.12, zIndex: 2 }}
            >
              <span className={styles.sticker} data-fx="sticker">
                {value}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      <div className={styles.columns} data-fx="columns">
        <p className={styles.body} data-fx="copy">
          I focus on clear layouts, strong type and interactions that feel right in the hand.
          Every project starts with what makes your brand different, then turns it into something
          sharp, functional and built to last.
        </p>
        <p className={styles.body} data-fx="copy">
          I work with founders, small teams and growing brands that want design with intent. From
          a first logo to a launch-day site, I turn loose ideas into a direction that makes sense.
        </p>
      </div>

      <div className={styles.aside} data-fx="aside">
        <span className={styles.rule} aria-hidden="true" data-fx="rule" />
        <p className={styles.body} data-fx="aside-copy">
          When I&rsquo;m not on client work, I&rsquo;m testing new tools, pulling apart design
          systems and building small experiments. The motion on this site started as one of them.
        </p>
      </div>
    </section>
  );
}

export default function StudioSections() {
  const rootRef = useRef<HTMLDivElement>(null);
  const introPrint = useRef<HalftoneControl | null>(null);
  const aboutPrint = useRef<HalftoneControl | null>(null);

  useComicMotion(rootRef, { intro: introPrint, about: aboutPrint });

  return (
    <div ref={rootRef} className={styles.wrap}>
      <IntroSection print={introPrint} />
      <AboutSection print={aboutPrint} />
    </div>
  );
}
