"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import portrait from "@/public/images/portrait.jpg";
import styles from "./HeroSection.module.css";

const ROWS = [
  { word: "Developer", direction: -1, accent: false },
  { word: "Designer", direction: 1, accent: true },
  { word: "Creative", direction: -1, accent: false },
];

// Enough repeats to cover an ultra-wide screen plus one wrap.
const COPIES = 5;
const BASE_SPEED = 60; // px per second
const SCROLL_PUSH = 0.9; // how strongly scroll velocity drives the rows
const COLUMNS = 7;

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

/** Rows drift in alternating directions; scrolling pushes them, scrolling up reverses them. */
function useMarquee(sectionRef: React.RefObject<HTMLElement | null>) {
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    const tracks = trackRefs.current.filter((t): t is HTMLDivElement => t !== null);
    if (!section || tracks.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const offsets = tracks.map((_, i) => -i * 180);
    let units = tracks.map((t) => (t.firstElementChild as HTMLElement).offsetWidth);
    let velocity = 1; // 1 = resting drift; sign follows scroll direction
    let lastScroll = window.scrollY;
    let lastTime = performance.now();
    let frame = 0;
    let visible = true;

    const measure = () => {
      units = tracks.map((t) => (t.firstElementChild as HTMLElement).offsetWidth);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const scrollDelta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      const scrollSign = scrollDelta < 0 ? -1 : 1;
      const target = scrollSign * (1 + Math.min(Math.abs(scrollDelta) * SCROLL_PUSH, 14));
      // Ease toward the scroll-driven target, then settle back to the resting drift.
      velocity += (target - velocity) * (Math.abs(target) > Math.abs(velocity) ? 0.25 : 0.06);

      tracks.forEach((track, i) => {
        const unit = units[i];
        if (!unit) return;
        offsets[i] += ROWS[i].direction * BASE_SPEED * velocity * dt;
        offsets[i] = ((offsets[i] % unit) + unit) % unit - unit;
        track.style.transform = `translate3d(${offsets[i]}px, 0, 0)`;
      });

      if (visible) frame = requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        lastTime = performance.now();
        lastScroll = window.scrollY;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(loop);
      }
    });
    observer.observe(section);

    const resizeObserver = new ResizeObserver(measure);
    tracks.forEach((t) => resizeObserver.observe(t.firstElementChild as HTMLElement));
    document.fonts?.ready.then(measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [sectionRef]);

  return trackRefs;
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRefs = useMarquee(sectionRef);
  const time = useClock();

  return (
    <section ref={sectionRef} className={styles.hero} aria-label="Dandy Studios">
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: COLUMNS - 1 }, (_, i) => (
          <span key={i} />
        ))}
      </div>


      <h1 className={styles.visuallyHidden}>Dandy Studios: developer, designer, creative.</h1>

      <div className={styles.stage} aria-hidden="true">
        {ROWS.map((row, i) => (
          <div
            key={row.word}
            className={styles.row}
            data-accent={row.accent}
            style={{ "--i": i } as React.CSSProperties}
          >
            <div
              className={styles.track}
              ref={(el) => {
                trackRefs.current[i] = el;
              }}
            >
              {Array.from({ length: COPIES }, (_, c) => (
                <span key={c} className={styles.word}>
                  {row.word}
                </span>
              ))}
            </div>
          </div>
        ))}

        <figure className={styles.portrait}>
          <Image
            src={portrait}
            alt=""
            priority
            placeholder="blur"
            sizes="(max-width: 640px) 60vw, 26vw"
          />
        </figure>
      </div>

      <footer className={styles.strip}>
        <p>
          Design &amp; development studio
          <span className={styles.dot} aria-hidden="true" />
          <time className={styles.clock} suppressHydrationWarning>
            {time ?? "--:--:--"}
          </time>
        </p>
        <p className={styles.scroll}>Scroll</p>
      </footer>

    </section>
  );
}
