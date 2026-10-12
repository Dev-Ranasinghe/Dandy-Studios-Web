"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import ZeroMeltPreloader from "@/components/ui/zero-melt-preloader";
import { SCROLL_HELD_ATTR } from "@/components/SmoothScroll";
import { useAccent } from "@/lib/accent";
import { LOADER_SEEN_ATTR as SEEN_ATTR, LOADER_SEEN_KEY as SEEN_KEY } from "@/lib/loader-boot";
import styles from "./SiteLoader.module.css";

const LOAD_MS = 1800;
// The accepted ring's flash fades straight off the page.
const HANDOFF_MS = 700;

/** The ring's light, fading off the page underneath; owns its own timer. */
function Handoff({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => doneRef.current(), reduced ? 250 : HANDOFF_MS);
    return () => window.clearTimeout(id);
  }, []);
  return <div className={styles.handoff} style={{ "--handoff-ms": `${HANDOFF_MS}ms` } as CSSProperties} />;
}

/**
 * The site's loading screen: a sheet of dark lavender ice wipes in while a counter runs down, then
 * the visitor draws a circle to melt through to the page (Tab reaches a "Skip and enter" key). The
 * ring floods with lilac light, which fades straight off the page. It holds the page (inert, no scroll)
 * until it is gone. It plays once per browser session: after that, page loads skip it.
 */
export default function SiteLoader() {
  const accent = useAccent();
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"loading" | "gate" | "handoff" | "gone">("loading");

  // Already played this session (flagged in <head> before paint): gone before it holds anything.
  useLayoutEffect(() => {
    if (document.documentElement.hasAttribute(SEEN_ATTR)) setPhase("gone");
  }, []);
  useEffect(() => {
    if (phase !== "gone") return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, [phase]);

  // Before the first GL frame the canvas is clear, so the ground covers the page until the
  // countdown ends. After that it has to go: melted holes show whatever sits behind the canvas.
  useEffect(() => {
    const id = window.setTimeout(() => setPhase((p) => (p === "loading" ? "gate" : p)), LOAD_MS);
    return () => window.clearTimeout(id);
  }, []);

  const holding = phase !== "gone";
  useEffect(() => {
    if (!holding) return;
    const root = document.documentElement;
    const page = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== rootRef.current,
    );
    page.forEach((el) => (el.inert = true));
    const { overflow } = root.style;
    root.style.overflow = "hidden";
    root.setAttribute(SCROLL_HELD_ATTR, "");
    return () => {
      page.forEach((el) => (el.inert = false));
      root.style.overflow = overflow;
      root.removeAttribute(SCROLL_HELD_ATTR);
    };
  }, [holding]);

  if (phase === "gone") return null;

  return (
    <div ref={rootRef} className={styles.loader} data-phase={phase} role="dialog" aria-modal="true" aria-label="Dandy Studios">
      {phase === "handoff" ? (
        <Handoff onDone={() => setPhase("gone")} />
      ) : (
        <ZeroMeltPreloader
          prompt="Draw a circle"
          hint="One full loop melts you in"
          retryHint="Not quite. One closed loop"
          wordmark="Dandy Studios"
          reward=""
          loadMs={LOAD_MS}
          baseColor={accent.night}
          frostColor={accent.lavender}
          meltColor={accent.plasma}
          glowColor={accent.lilac}
          flashColor={accent.lilac}
          onUnlock={() => setPhase("handoff")}
        />
      )}
    </div>
  );
}
