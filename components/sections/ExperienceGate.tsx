"use client";

import { useEffect, useRef } from "react";
import styles from "./ExperienceGate.module.css";

/**
 * The camera's way in and out, drawn as a lens: a plasma veil over the frame with the grid
 * showing through, a lilac dot scanline, a reticle that tightens as loading progresses and a
 * Caslon counter reading real progress. Opening ends with an iris that reveals the camera;
 * closing freezes the last camera frame and irises shut over it.
 */

type Props = {
  mode: "start" | "stop";
  /** 0..1; the counter eases toward it. */
  progress: number;
  stage: string;
  /** Plays the exit (iris open for start, fade for stop), then calls onDone. */
  ending: boolean;
  onDone: () => void;
  /** Stop only: the camera's last frame, frozen under the closing iris. */
  snapshot?: HTMLCanvasElement | null;
};

export default function ExperienceGate({ mode, progress, stage, ending, onDone, snapshot }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const shotRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(progress);
  const doneRef = useRef(onDone);
  targetRef.current = progress;
  doneRef.current = onDone;

  // The counter eases toward the real progress; written straight to the DOM, no re-renders.
  useEffect(() => {
    const root = rootRef.current;
    const num = numRef.current;
    if (!root || !num) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let shown = mode === "stop" ? 1 : 0;
    let frame = 0;
    const step = () => {
      const target = targetRef.current;
      shown += (target - shown) * (reduce ? 1 : 0.09);
      if (Math.abs(target - shown) < 0.002) shown = target;
      const pct = Math.round(shown * 100);
      num.textContent = String(pct).padStart(2, "0");
      root.style.setProperty("--p", shown.toFixed(3));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    const holder = shotRef.current;
    if (!holder || !snapshot) return;
    snapshot.className = styles.snapshot;
    holder.appendChild(snapshot);
    return () => snapshot.remove();
  }, [snapshot]);

  // The exit is a CSS animation; its end hands control back.
  useEffect(() => {
    if (!ending) return;
    const root = rootRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || reduce) {
      doneRef.current();
      return;
    }
    const onEnd = (e: AnimationEvent) => {
      if (e.target === root || (e.target as Element).classList.contains(styles.veil)) doneRef.current();
    };
    root.addEventListener("animationend", onEnd);
    // Never trust an animation to end: a hidden tab skips it.
    const fallback = window.setTimeout(() => doneRef.current(), 1400);
    return () => {
      root.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [ending]);

  return (
    <div ref={rootRef} className={styles.gate} data-mode={mode} data-ending={ending || undefined} role="status">
      <div ref={shotRef} className={styles.shot} aria-hidden="true" />
      <div className={styles.veil} aria-hidden="true">
        <div className={styles.scan} />
      </div>

      <div className={styles.reticle} aria-hidden="true" />

      <div className={styles.readout}>
        <p className={styles.label}>
          <span aria-hidden="true">( </span>
          {mode === "start" ? "Opening the lens" : "Closing the lens"}
          <span aria-hidden="true"> )</span>
        </p>
        <p className={styles.count} aria-hidden="true">
          <span ref={numRef}>{mode === "stop" ? "100" : "00"}</span>
          <span className={styles.pct}>%</span>
        </p>
        <p className={styles.stage}>{stage}</p>
        <span className={styles.bar} aria-hidden="true" />
      </div>
    </div>
  );
}
