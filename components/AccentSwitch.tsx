"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Glass } from "@samasante/liquid-glass";
import GlassLayer from "@/components/ui/GlassLayer";
import { ACCENTS, ACCENT_ORDER, setAccent, useAccentName, type Accent } from "@/lib/accent";
import styles from "./AccentSwitch.module.css";

/** The tray is the same liquid glass as the bar it hangs from. */
const TRAY_OPTICS = {
  strength: 0.12,
  depth: 0.8,
  curvature: 0.5,
  bend: 0.9,
  bendWidth: 0.2,
  dispersion: 0.6,
  frost: 5,
  saturate: 1.2,
  sheen: 0.6,
  glow: 0.16,
};

/**
 * The accent picker in the site header: a tile showing the current accent opens a small tray of
 * swatches. Picking one re-themes the whole site (see lib/accent.ts); the tray stays open so
 * the visitor can compare, and closes on Escape, the tile again, any press or focus outside it,
 * or the moment the page scrolls.
 */
export default function AccentSwitch() {
  const current = useAccentName();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Accent | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduceMotion = useReducedMotion();
  const trayId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => !rootRef.current?.contains(target as Node);
    const close = () => setOpen(false);
    // Capture phase, so a control that stops its own events (the hero's switches) still closes it.
    const onPointer = (e: PointerEvent) => outside(e.target) && close();
    const onFocus = (e: FocusEvent) => outside(e.target) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Only this tray closes; the menu behind it (if open) stays.
      e.stopImmediatePropagation();
      close();
      buttonRef.current?.focus();
    };
    // Any scroll puts it away: the bar itself tucks away on the way down.
    const startY = window.scrollY;
    const onScroll = () => Math.abs(window.scrollY - startY) > 4 && close();
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("focusin", onFocus, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("touchmove", close, { passive: true });
    const focusTimer = window.setTimeout(() => swatchRefs.current[ACCENT_ORDER.indexOf(current)]?.focus(), 60);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("focusin", onFocus, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", close);
      window.removeEventListener("touchmove", close);
      window.clearTimeout(focusTimer);
      setPreview(null);
    };
  }, [open]);

  // Radio-group keys: arrows move and pick, Home/End jump to the ends.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = ACCENT_ORDER.indexOf(current);
    const last = ACCENT_ORDER.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setAccent(ACCENT_ORDER[next]);
    swatchRefs.current[next]?.focus();
  };

  const named = preview ?? current;

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.tile} glass-host`}
        aria-expanded={open}
        aria-controls={trayId}
        aria-label={`Theme colour: ${ACCENTS[current].label}`}
        title="Theme colour"
        onClick={() => setOpen((v) => !v)}
      >
        <GlassLayer />
        <span className={styles.dot} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={trayId}
            className={styles.tray}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 480, damping: 30 } }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4, scale: reduceMotion ? 1 : 0.97, transition: { duration: 0.15 } }}
          >
            <Glass className={styles.glass} radius={14} optics={TRAY_OPTICS} style={{ display: "grid" }}>
              <div
                role="radiogroup"
                aria-label="Theme colour"
                className={styles.swatches}
                onKeyDown={onKeyDown}
                onPointerLeave={() => setPreview(null)}
              >
                {ACCENT_ORDER.map((accent, i) => {
                  const palette = ACCENTS[accent];
                  const checked = accent === current;
                  return (
                    <button
                      key={accent}
                      ref={(el) => {
                        swatchRefs.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={palette.label}
                      tabIndex={checked ? 0 : -1}
                      className={styles.swatch}
                      style={
                        {
                          "--s-dark": palette.lavender,
                          "--s-light": palette.highlight,
                        } as React.CSSProperties
                      }
                      onClick={() => setAccent(accent)}
                      onPointerEnter={() => setPreview(accent)}
                      onFocus={() => setPreview(null)}
                    />
                  );
                })}
              </div>
              <p className={styles.name} aria-hidden="true">
                {ACCENTS[named].label}
              </p>
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
