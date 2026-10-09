"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { NAV } from "./nav";
import { SERVICES } from "./services";
import Image from "next/image";
import portrait from "@/public/images/portrait-pixel.png";
import GlassLayer from "@/components/ui/GlassLayer";
import styles from "./Footer.module.css";

const SOCIAL = [
  { label: "Instagram", href: "https://instagram.com/" },
  { label: "X", href: "https://x.com/" },
  { label: "LinkedIn", href: "https://linkedin.com/" },
];

/* ---------- Panel shape ---------- */

type Shape = {
  radius: number;
  tabWidth: number;
  tabHeight: number;
  notchLeft: number; // 0 = no notch
  notchRight: number;
  notchHeight: number;
};

/** Horizontal run of the S-curve that steps down out of each bottom notch. */
const notchRun = (notchHeight: number) => notchHeight * 1.4;

/**
 * The dark panel's outline: a rounded rectangle whose top edge rises into a centred tab
 * and whose bottom corners step up into notches. Every step is a soft S-curve.
 */
function panelPath(w: number, h: number, s: Shape) {
  const { radius: r, tabWidth: tw, tabHeight: th, notchHeight: nh } = s;
  const f = th * 1.6; // horizontal run of the tab's S-curves
  const cx = w / 2;
  const tl = cx - tw / 2;
  const tr = cx + tw / 2;
  const hasNotches = s.notchLeft > 0 && s.notchRight > 0;
  const low = hasNotches ? h - nh : h; // bottom edge at the corners

  const p: string[] = [];
  p.push(`M ${r} ${th}`);
  // Top edge and the tab.
  p.push(`L ${tl - f} ${th}`);
  p.push(`C ${tl - f / 2} ${th} ${tl - f / 2} 0 ${tl} 0`);
  p.push(`L ${tr} 0`);
  p.push(`C ${tr + f / 2} 0 ${tr + f / 2} ${th} ${tr + f} ${th}`);
  p.push(`L ${w - r} ${th}`);
  p.push(`Q ${w} ${th} ${w} ${th + r}`);
  // Right edge down to the bottom-right corner.
  p.push(`L ${w} ${low - r}`);
  p.push(`Q ${w} ${low} ${w - r} ${low}`);
  if (hasNotches) {
    const g = notchRun(nh);
    const nr = w - s.notchRight;
    p.push(`L ${nr + g} ${low}`);
    p.push(`C ${nr + g / 2} ${low} ${nr + g / 2} ${h} ${nr} ${h}`);
    const nl = s.notchLeft;
    p.push(`L ${nl} ${h}`);
    p.push(`C ${nl - g / 2} ${h} ${nl - g / 2} ${low} ${nl - g} ${low}`);
  }
  p.push(`L ${r} ${low}`);
  p.push(`Q 0 ${low} 0 ${low - r}`);
  p.push(`L 0 ${th + r}`);
  p.push(`Q 0 ${th} ${r} ${th}`);
  p.push("Z");
  return p.join(" ");
}

function usePanelShape() {
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLParagraphElement>(null);
  const rightRef = useRef<HTMLAnchorElement>(null);
  const [clip, setClip] = useState<string | undefined>(undefined);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const update = () => {
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const css = getComputedStyle(panel);
      const read = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
      const tabHeight = read("--tab-h");
      const tabPad = read("--tab-pad");
      const notchHeight = read("--notch-h");
      // Label, then breathing room, then the curve down to the panel's bottom edge.
      const notchExtra = read("--notch-gap") + notchRun(notchHeight);

      const left = leftRef.current;
      const right = rightRef.current;
      const notched = !!left && getComputedStyle(left).position === "absolute";

      const shape: Shape = {
        radius: read("--radius"),
        tabWidth: (tabRef.current?.offsetWidth ?? 0) + tabPad * 2,
        tabHeight,
        notchHeight,
        // On phones the labels sit below the panel and the notches take a set width.
        notchLeft: notched && left ? left.offsetWidth + notchExtra : read("--notch-w"),
        notchRight: notched && right ? right.offsetWidth + notchExtra : read("--notch-w"),
      };
      setClip(`path("${panelPath(w, h, shape)}")`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    document.fonts?.ready.then(update);
    return () => observer.disconnect();
  }, []);

  return { panelRef, tabRef, leftRef, rightRef, clip };
}

function useClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(format.format(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return time;
}

/** The ticking time on its own, so only this text re-renders every second, not the section. */
function Clock() {
  const time = useClock();
  return <>{time ?? "--:--:--"}</>;
}

const ROLL_EASE = [0.76, 0, 0.24, 1] as const;

/**
 * Link whose letters roll up on hover, one after another, revealing a highlighted copy
 * underneath. Screen readers get the plain label.
 */
function RollLink({ label, ...props }: { label: string } & React.ComponentProps<"a">) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(false);
  const letters = Array.from(label);

  return (
    <motion.a
      {...(props as React.ComponentProps<typeof motion.a>)}
      className={styles.bigLink}
      aria-label={label}
      data-active={active || undefined}
      initial={false}
      animate={active ? "hover" : "rest"}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <span className={styles.roll} aria-hidden="true">
        {letters.map((char, i) => (
          <motion.span
            key={i}
            className={styles.letter}
            data-char={char === " " ? "\u00a0" : char}
            variants={{
              rest: { y: "0%" },
              hover: { y: reduceMotion ? "0%" : "-100%" },
            }}
            transition={{ duration: 0.5, ease: ROLL_EASE, delay: i * 0.025 }}
          >
            {char === " " ? "\u00a0" : char}
          </motion.span>
        ))}
      </span>
    </motion.a>
  );
}

/**
 * The portrait buried at the bottom of a pit: a real 3D shaft (four walls in perspective,
 * the print as its floor). With a mouse, the viewpoint follows the pointer so you can peer
 * down different walls.
 */
function Pit() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const look = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduceMotion || event.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--look-x", `${50 - x * 36}%`);
    el.style.setProperty("--look-y", `${35 - y * 36}%`);
  };

  const rest = () => {
    ref.current?.style.removeProperty("--look-x");
    ref.current?.style.removeProperty("--look-y");
  };

  return (
    <div ref={ref} className={styles.pit} onPointerMove={look} onPointerLeave={rest}>
      <div className={styles.shaft}>
        <div className={styles.floor}>
          <Image
            className={styles.portrait}
            src={portrait}
            alt="Portrait of the founder of Dandy Studios holding a red rose in his teeth"
            sizes="(max-width: 640px) 70vw, (max-width: 1024px) 50vw, 30vw"
          />
        </div>
        <span className={`${styles.wall} ${styles.wallTop}`} aria-hidden="true" />
        <span className={`${styles.wall} ${styles.wallBottom}`} aria-hidden="true" />
        <span className={`${styles.wall} ${styles.wallLeft}`} aria-hidden="true" />
        <span className={`${styles.wall} ${styles.wallRight}`} aria-hidden="true" />
      </div>
    </div>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 12 12 4M5.5 4H12v6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
      />
    </svg>
  );
}

export default function Footer() {
  const { panelRef, tabRef, leftRef, rightRef, clip } = usePanelShape();
  const year = new Date().getFullYear();

  return (
    <footer id="footer" className={styles.footer} data-scene="Credits">
      <div
        ref={panelRef}
        className={styles.panel}
        data-shaped={clip ? "true" : undefined}
        style={clip ? { clipPath: clip } : undefined}
      >
        <div ref={tabRef} className={styles.tab}>
          <span className={styles.dot} aria-hidden="true" />
          <span>Local time</span>
          <time className={styles.clock} suppressHydrationWarning>
            <Clock />
          </time>
        </div>

        <h2 className={styles.headline}>
          <span>Dandy</span> <span className={styles.accent}>Studios</span>
        </h2>

        <div className={styles.columns}>
          <nav className={styles.column} aria-label="Footer">
            <p className={styles.label}>Pages</p>
            <ul>
              {NAV.map((item) => (
                <li key={item.label}>
                  <RollLink label={item.label} href={item.href} />
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.column}>
            <p className={styles.label}>Follow on</p>
            <ul>
              {SOCIAL.map((item) => (
                <li key={item.label}>
                  <RollLink
                    label={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.strip} aria-hidden="true">
          <div className={styles.stripTrack}>
            {[0, 1].map((group) => (
              <div className={styles.stripGroup} key={group}>
                {SERVICES.map((service) => (
                  <span className={styles.service} key={service}>
                    <svg className={styles.star} viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M6 0 7.2 4.8 12 6 7.2 7.2 6 12 4.8 7.2 0 6 4.8 4.8Z" fill="currentColor" />
                    </svg>
                    {service}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.figure}>
          <Pit />

          <a className={`${styles.cta} glass-host glass-solid`} href="/contact">
            <GlassLayer />
            Start a project
            <ArrowIcon className={styles.ctaIcon} />
          </a>
        </div>
      </div>

      <div className={styles.base}>
        <p ref={leftRef} className={styles.copyright}>
          © {year} Dandy Studios. All rights reserved
        </p>
        <a ref={rightRef} className={styles.top} href="#">
          Back to top
          <ArrowIcon className={styles.topIcon} />
        </a>
      </div>
    </footer>
  );
}
