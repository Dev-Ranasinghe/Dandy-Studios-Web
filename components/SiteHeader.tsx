"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "framer-motion";
import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { ArrowRight, SkipForward } from "lucide-react";
import { TRACKS, nextTrack, onSoundChange, toggleSound } from "@/lib/hero-sound";
import { NAV } from "@/components/nav";
import { ShaderBackground } from "@/components/ui/shader-anima";
import GlassLayer from "@/components/ui/GlassLayer";
import { SCROLL_HELD_ATTR } from "@/components/SmoothScroll";
import AccentSwitch from "@/components/AccentSwitch";
import { useAccent, useAccentName, type AccentPalette } from "@/lib/accent";
import styles from "./SiteHeader.module.css";

/** Letters drawn with the wide alternate, like the reference's long E and B. */
const LONG_LETTERS = new Set(["E", "B"]);

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fired on window when the site menu opens. */
export const MENU_OPEN_EVENT = "sitemenuopen";

type Mode = "day" | "night";
const MODE_KEY = "dandy-menu-mode";

/** Hex to the shader's 0..1 sRGB triple. */
const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

// The menu's moving ground is the warp-stripe shader in the current accent, darkest to lightest.
// Day runs plasma → lavender → lilac → pale (bone went grey under the shader's darkening);
// night drops a step, from the tinted ink up to lilac.
const shaderColors = (a: AccentPalette, mode: Mode) =>
  (mode === "day" ? [a.plasma, a.lavender, a.highlight, a.pale] : [a.night, a.plasma, a.lavender, a.highlight]).map(rgb);

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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
  const [mode, setMode] = useState<Mode>("day");
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const accent = useAccent();
  const accentName = useAccentName();
  const [music, setMusic] = useState({ on: false, index: 0 });
  useEffect(() => onSoundChange(setMusic), []);

  // The chosen mode is remembered per visitor; storage can be unavailable, so it's best-effort.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "day" || saved === "night") setMode(saved);
    } catch {}
  }, []);

  const toggleMode = () =>
    setMode((current) => {
      const next = current === "day" ? "night" : "day";
      try {
        localStorage.setItem(MODE_KEY, next);
      } catch {}
      return next;
    });
  const openRef = useRef(open);
  openRef.current = open;

  // The bar tucks away while scrolling down and returns on the way back up. A plain passive
  // listener, one read of scrollY per frame: ScrollTrigger updated inside every scroll event and
  // read the bar's layout each time, forcing a style recalc at the start of each scroll.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    // Clear the bar's own top offset too, since it may sit lower, inside the hero frame.
    let away = 0;
    const measure = () => {
      away = -(bar.offsetTop + bar.offsetHeight + 8);
    };
    measure();
    let lastY = window.scrollY;
    let hidden = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y === lastY) return;
      const hide = y > lastY && y > 160 && !openRef.current;
      lastY = y;
      if (hide === hidden) return;
      hidden = hide;
      // Lets the camera overlay's readouts take the bar's place while it is tucked away.
      if (hide) document.documentElement.dataset.navHidden = "";
      else delete document.documentElement.dataset.navHidden;
      gsap.to(bar, { y: hide ? away : 0, duration: 0.5, ease: "power3.out", overwrite: true });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      if (hidden) gsap.set(bar, { y: away });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Opening the menu brings the bar back (below); count it as shown so the next scroll down hides it again.
    const onMenu = () => {
      hidden = false;
      delete document.documentElement.dataset.navHidden;
    };
    window.addEventListener(MENU_OPEN_EVENT, onMenu);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(MENU_OPEN_EVENT, onMenu);
    };
  }, []);

  // Open menu: lock scroll, park the page behind `inert`, Escape closes, focus returns to the button.
  useEffect(() => {
    if (!open) return;
    // Lets the page react to the menu (the hero switches its camera off).
    window.dispatchEvent(new Event(MENU_OPEN_EVENT));
    gsap.to(barRef.current, { y: 0, duration: 0.3, overwrite: true });
    const page = Array.from(document.querySelectorAll<HTMLElement>("main, footer"));
    page.forEach((el) => (el.inert = true));
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.setAttribute(SCROLL_HELD_ATTR, "");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => firstLinkRef.current?.focus({ preventScroll: true }), 350);
    const button = buttonRef.current;
    return () => {
      page.forEach((el) => (el.inert = false));
      document.documentElement.style.overflow = overflow;
      document.documentElement.removeAttribute(SCROLL_HELD_ATTR);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      setActive(null);
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <header ref={barRef} className={styles.bar} data-open={open || undefined}>
        <GlassLayer look="bar" radius={14} />
        <a href="/" className={styles.logo} aria-label="Dandy Studios, home">
          <span>Dandy</span>
          <span>Studios</span>
        </a>

        <nav className={styles.links} aria-label="Primary">
          {NAV.filter((item) => item.href !== "/").map((item) => (
            <a key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <AnimatePresence>
            {open && (
              <motion.button
                type="button"
                className={`${styles.mode} glass-host`}
                aria-label={mode === "day" ? "Switch to night mode" : "Switch to day mode"}
                onClick={toggleMode}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 20, delay: 0.25 } }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
                whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
              >
                {/* The icon shows the current mode: sun by day, moon at night. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={mode}
                    className={styles.modeIcon}
                    initial={reduceMotion ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={reduceMotion ? undefined : { rotate: 90, scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {mode === "day" ? <SunIcon /> : <MoonIcon />}
                  </motion.span>
                </AnimatePresence>
                <GlassLayer />
              </motion.button>
            )}
          </AnimatePresence>


          <AccentSwitch />

          {/* Music: muted until clicked. The bars play while it's on; "next" changes track. */}
          <div className={styles.music}>
            <button
              type="button"
              className={`${styles.musicButton} glass-host`}
              aria-pressed={music.on}
              aria-label={music.on ? `Mute music (playing ${TRACKS[music.index].title})` : "Play music"}
              title={music.on ? TRACKS[music.index].title : "Play music"}
              onClick={toggleSound}
            >
              <GlassLayer />
              <span className={styles.bars} data-on={music.on || undefined} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} style={{ "--b": i } as React.CSSProperties} />
                ))}
              </span>
            </button>
            {music.on && (
              <button type="button" className={`${styles.nextButton} glass-host`} aria-label="Next track" title="Next track" onClick={nextTrack}>
                <GlassLayer />
                <SkipForward aria-hidden="true" strokeWidth={2} />
              </button>
            )}
          </div>

          <motion.button
            ref={buttonRef}
            type="button"
            className={`${styles.menuButton} glass-host`}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
          >
            <GlassLayer />
            <motion.span
              className={styles.line}
              animate={open ? { y: 0, rotate: 45 } : { y: -3.5, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            />
            <motion.span
              className={styles.line}
              animate={open ? { y: 0, rotate: -45 } : { y: 3.5, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            />
          </motion.button>

          <motion.a
            href="/contact"
            className={`${styles.talk} glass-host glass-solid`}
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            <GlassLayer />
            Let&rsquo;s talk
            <ArrowRight aria-hidden="true" strokeWidth={2.2} />
          </motion.a>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="site-menu"
            className={styles.overlay} data-lenis-prevent
            data-mode={mode}
            aria-label="Main"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: reduceMotion ? 0 : 0.8, ease: EASE } }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: reduceMotion ? 0 : 0.55, ease: [0.7, 0, 0.84, 0] } }}
          >
            {/*
              Mounted only while the menu is open. Switching mode or accent crossfades a new
              shader, in the new palette, over the old one.
            */}
            <AnimatePresence initial={false}>
              <motion.div
                key={`${mode}-${accentName}`}
                className={styles.video}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: reduceMotion ? 0 : 0.9, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.9, delay: 0.1 } }}
              >
                <ShaderBackground colors={shaderColors(accent, mode)} interactive={false} maxPixels={600_000} />
              </motion.div>
            </AnimatePresence>
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
