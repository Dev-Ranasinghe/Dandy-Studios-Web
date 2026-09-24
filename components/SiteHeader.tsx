"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { NAV } from "@/components/nav";
import styles from "./SiteHeader.module.css";

/** Letters drawn with the wide alternate, like the reference's long E and B. */
const LONG_LETTERS = new Set(["E", "B"]);

const EASE = [0.16, 1, 0.3, 1] as const;

function Chevrons() {
  return (
    <svg className={styles.chevrons} viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path d="M2 1.5 6.5 6 2 10.5M8.5 1.5 13 6l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Splits a label so the long letters can take the wide cut of the variable face. */
function Lettering({ text }: { text: string }) {
  return (
    <>
      {text
        .toUpperCase()
        .split("")
        .map((char, i) =>
          LONG_LETTERS.has(char) ? (
            <span key={i} className={styles.long}>
              {char}
            </span>
          ) : (
            char
          ),
        )}
    </>
  );
}

type ItemProps = {
  item: (typeof NAV)[number];
  index: number;
  active: boolean;
  dimmed: boolean;
  onActivate: (index: number | null) => void;
  onNavigate: () => void;
  linkRef?: React.Ref<HTMLAnchorElement>;
};

function MenuItem({ item, index, active, dimmed, onActivate, onNavigate, linkRef }: ItemProps) {
  const reduceMotion = useReducedMotion();
  // One spring drives size, weight, width and colour together; low damping gives the pop its bounce.
  const pop = useSpring(0, reduceMotion ? { duration: 0 } : { stiffness: 260, damping: 15, mass: 0.9 });

  useEffect(() => {
    pop.set(active ? 1 : 0);
  }, [active, pop]);

  const marquee = Array.from({ length: 8 }, () => item.note);

  return (
    <motion.li
      className={styles.item}
      data-active={active || undefined}
      data-dimmed={dimmed || undefined}
      style={{ "--p": pop } as React.CSSProperties}
      variants={{
        hidden: { opacity: 0, y: 48 },
        shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 20 } },
      }}
    >
      <a
        ref={linkRef}
        href={item.href}
        className={styles.link}
        aria-describedby={`nav-note-${index}`}
        onPointerEnter={(e) => e.pointerType === "mouse" && onActivate(index)}
        onFocus={() => onActivate(index)}
        onClick={onNavigate}
      >
        <span className={styles.word}>
          <Lettering text={item.label} />
        </span>
      </a>
      {/* The small line under the active item runs sideways, as in the reference. */}
      <span id={`nav-note-${index}`} className={styles.note}>
        <span className={styles.srOnly}>{item.note}</span>
        <span className={styles.noteTrack} aria-hidden="true">
          {[0, 1].map((half) => (
            <span key={half} className={styles.noteHalf}>
              {marquee.map((text, i) => (
                <span key={i}>
                  {text}
                  <span className={styles.bullet} />
                </span>
              ))}
            </span>
          ))}
        </span>
      </span>
    </motion.li>
  );
}

export default function SiteHeader() {
  const barRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const openRef = useRef(open);
  openRef.current = open;

  // The bar tucks away while scrolling down and returns on the way back up.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    gsap.registerPlugin(ScrollTrigger);
    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const hide = self.direction === 1 && self.scroll() > 160 && !openRef.current;
        gsap.to(bar, { yPercent: hide ? -140 : 0, duration: 0.5, ease: "power3.out", overwrite: true });
      },
    });
    return () => trigger.kill();
  }, []);

  // Open menu: lock scroll, park the page behind `inert`, Escape closes, focus returns to the button.
  useEffect(() => {
    if (!open) return;
    gsap.to(barRef.current, { yPercent: 0, duration: 0.3, overwrite: true });
    const page = Array.from(document.querySelectorAll<HTMLElement>("main, footer"));
    page.forEach((el) => (el.inert = true));
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => firstLinkRef.current?.focus({ preventScroll: true }), 350);
    const button = buttonRef.current;
    return () => {
      page.forEach((el) => (el.inert = false));
      document.documentElement.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      setActive(null);
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <header ref={barRef} className={styles.bar} data-open={open || undefined}>
        <a href="/" className={styles.logo} aria-label="Dandy Studios, home">
          <span>Dandy</span>
          <span>Studios</span>
        </a>

        <div className={styles.actions}>
          <motion.a
            href="/contact"
            className={styles.talk}
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            Let&rsquo;s talk
            <Chevrons />
          </motion.a>

          <motion.button
            ref={buttonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
          >
            <motion.span
              className={styles.line}
              animate={open ? { y: 0, rotate: 45 } : { y: -5, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            />
            <motion.span
              className={styles.line}
              animate={open ? { y: 0, rotate: -45 } : { y: 5, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            />
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="site-menu"
            className={styles.overlay}
            aria-label="Main"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: reduceMotion ? 0 : 0.8, ease: EASE } }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: reduceMotion ? 0 : 0.55, ease: [0.7, 0, 0.84, 0] } }}
          >
            {/* Loaded only when the menu opens; the poster covers the first frame and reduced motion. */}
            <video
              className={styles.video}
              src="/video/menu-water.mp4"
              poster="/video/menu-water-poster.jpg"
              autoPlay={!reduceMotion}
              muted
              loop
              playsInline
              aria-hidden="true"
            />
            <div className={styles.tint} aria-hidden="true" />

            <motion.ul
              className={styles.list}
              data-has-active={active !== null || undefined}
              onPointerLeave={() => setActive(null)}
              initial="hidden"
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06, delayChildren: 0.2 } } }}
            >
              {NAV.map((item, i) => (
                <MenuItem
                  key={item.href}
                  item={item}
                  index={i}
                  active={active === i}
                  dimmed={active !== null && active !== i}
                  onActivate={setActive}
                  onNavigate={() => setOpen(false)}
                  linkRef={i === 0 ? firstLinkRef : undefined}
                />
              ))}
            </motion.ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
