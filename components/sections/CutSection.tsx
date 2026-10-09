"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import pile from "@/public/images/pile.webp";
import CursorTrail from "@/components/ui/cursor-trail";
import GlassLayer from "@/components/ui/GlassLayer";
import styles from "./CutSection.module.css";

function DownArrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v9M3.5 7.5 8 12l4.5-4.5" />
    </svg>
  );
}

function RightArrow() {
  return (
    <svg className={styles.buttonArrow} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 8h10M8.5 3.5 13 8l-4.5 4.5" />
    </svg>
  );
}

/**
 * Closing call to action. The headline does what it says: once it rises into view, a slash
 * cuts through "BS." and the two halves slip apart, then the emoji drops in.
 */
export default function CutSection() {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={styles.section} data-shown={shown} aria-labelledby="cut-heading" data-scene="Let's talk">
      <p className={styles.label}>
        <DownArrow />
        <span>
          <span aria-hidden="true">(</span> Seriously <span aria-hidden="true">)</span>
        </span>
        <DownArrow />
      </p>

      <h2 id="cut-heading" className={styles.heading} aria-label="Let's cut the BS.">
        <span className={styles.line} aria-hidden="true">
          <span className={styles.rise}>Let&rsquo;s cut</span>
        </span>
        <span className={styles.line} aria-hidden="true">
          <span className={styles.rise}>
            the{" "}
            <span className={styles.cut}>
              <span className={styles.lower}>BS.</span>
              <span className={styles.upper}>BS.</span>
              <span className={styles.slash} />
            </span>
            {/* Cut out of the supplied artwork (public/images/pile.webp) on a transparent ground. */}
            <Image className={styles.emoji} src={pile} alt="" sizes="(min-width: 768px) 200px, 64px" priority={false} />
          </span>
        </span>
      </h2>

      <div className={styles.actions}>
        <a className={`${styles.button} glass-host glass-solid`} href="/contact">
          <GlassLayer />
          Get a custom quote
          <RightArrow />
        </a>
        <span className={styles.cursor} aria-hidden="true" />
      </div>
      <CursorTrail />
    </section>
  );
}
