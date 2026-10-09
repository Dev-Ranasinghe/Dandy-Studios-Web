"use client";

import { useEffect, useRef } from "react";
import styles from "./ClientsSection.module.css";

// PLACEHOLDER: names from the design reference, not Dandy Studios clients. Replace before launch.
const CLIENTS = ["Droga5", "Google", "Evian", "Levi's", "Capital One", "Nike", "Spotify"];

// Enough copies of the list to cover an ultra-wide screen plus one wrap.
const COPIES = 3;
const BASE_SPEED = 55; // px per second
const SCROLL_PUSH = 0.8;

/** Drifts left at rest; scrolling speeds it up and scrolling up turns it around. */
function useMarquee(sectionRef: React.RefObject<HTMLElement | null>, trackRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let unit = (track.firstElementChild as HTMLElement).offsetWidth;
    let offset = 0;
    let velocity = 1;
    let lastScroll = window.scrollY;
    let lastTime = performance.now();
    let frame = 0;
    let visible = false;

    const loop = (now: number) => {
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
      lastTime = now;

      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      const target = (delta < 0 ? -1 : 1) * (1 + Math.min(Math.abs(delta) * SCROLL_PUSH, 12));
      velocity += (target - velocity) * (Math.abs(target) > Math.abs(velocity) ? 0.2 : 0.05);

      offset -= BASE_SPEED * velocity * dt;
      offset = ((offset % unit) + unit) % unit - unit;
      track.style.transform = `translate3d(${offset}px, 0, 0)`;

      if (visible) frame = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) {
        lastTime = performance.now();
        lastScroll = window.scrollY;
        frame = requestAnimationFrame(loop);
      }
    });
    io.observe(section);

    const ro = new ResizeObserver(() => {
      unit = (track.firstElementChild as HTMLElement).offsetWidth;
    });
    ro.observe(track);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [sectionRef, trackRef]);
}

export default function ClientsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useMarquee(sectionRef, trackRef);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="clients-heading" data-scene="Clients">
      <h2 id="clients-heading" className={`${styles.label} marker`}>
        <span aria-hidden="true">(</span> Clients <span aria-hidden="true">)</span>
      </h2>

      {/* Screen readers get the list once; the looping copies are decoration. */}
      <ul className={styles.srOnly}>
        {CLIENTS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      <div className={styles.viewport} aria-hidden="true">
        <div ref={trackRef} className={styles.track}>
          {Array.from({ length: COPIES }, (_, copy) => (
            <div key={copy} className={styles.set}>
              {CLIENTS.map((name) => (
                <span key={name} className={styles.item}>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.dot} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
