"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { WORK } from "@/components/work";
import styles from "./TreatmentsSection.module.css";

// Five boards from the work index (stand-ins until real case studies arrive; see work.ts).
const BOARDS = WORK.slice(0, 5);

/** A row of sprocket holes along a frame's edge. */
function Perfs() {
  return (
    <span className={styles.perfs} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

/**
 * Selected work as a strip of film: the section pins and the strip runs sideways as the page
 * scrolls, each board a frame between sprocket rows, its clip playing while it sits in the
 * gate. A slate line heads it; a progress rule underneath tracks the reel.
 */
export default function TreatmentsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    const strip = stripRef.current;
    if (!section || !strip) return;
    const videos = Array.from(strip.querySelectorAll("video"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The frame nearest the middle of the screen plays; the others hold their poster.
    let current = -1;
    const pick = () => {
      const mid = window.innerWidth / 2;
      let best = -1;
      let bestD = Infinity;
      videos.forEach((v, i) => {
        const r = v.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best === current) return;
      current = best;
      videos.forEach((v, i) => {
        if (i === best) v.play().catch(() => {});
        else v.pause();
      });
    };

    if (reduce) {
      // No pin: the strip scrolls sideways by hand.
      strip.parentElement?.classList.add(styles.manual);
      return;
    }

    const ctx = gsap.context(() => {
      const travel = () => strip.scrollWidth - window.innerWidth;
      gsap.to(strip, {
        x: () => -travel(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${travel()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressRef.current) progressRef.current.style.transform = `scaleX(${self.progress.toFixed(4)})`;
            pick();
          },
          onLeave: () => videos.forEach((v) => v.pause()),
          onLeaveBack: () => videos.forEach((v) => v.pause()),
          onEnter: () => {
            current = -1;
            pick();
          },
          onEnterBack: () => {
            current = -1;
            pick();
          },
        },
      });
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    // GSAP's pin wraps the section in a spacer, moving it in the DOM; this outer div is the node
    // React owns and removes, so the moved section never trips React's unmount.
    <div className={styles.host} data-scene="Selected work">
    <section ref={sectionRef} className={styles.section} aria-labelledby="treatments-heading">
      <header className={styles.slate}>
        <span className={styles.clapper} aria-hidden="true" />
        <div className={styles.slateRow}>
          <span className={styles.scene}>Sc 01</span>
          <h2 id="treatments-heading" className={styles.title}>
            Selected treatments
          </h2>
          <span className={styles.take}>
            Take 01 · {String(BOARDS.length).padStart(2, "0")} boards
          </span>
        </div>
      </header>

      <div className={styles.gate}>
        <div ref={stripRef} className={styles.strip}>
          {BOARDS.map((piece, i) => (
            <a key={piece.id} href="/work" className={styles.frame} aria-label={`${piece.title}: see the work`}>
              <Perfs />
              <span className={styles.picture}>
                <video
                  className={styles.media}
                  src={piece.video}
                  poster={piece.poster}
                  preload="none"
                  muted
                  loop
                  playsInline
                  aria-hidden="true"
                />
                <span className={styles.number}>№ {String(i + 1).padStart(2, "0")}</span>
                <span className={styles.caption}>{piece.title}</span>
              </span>
              <Perfs />
            </a>
          ))}
        </div>
      </div>

      <div className={styles.rule} aria-hidden="true">
        <span ref={progressRef} />
      </div>
    </section>
    </div>
  );
}
