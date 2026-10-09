"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./RecordingHud.module.css";

type Scene = { name: string; el: HTMLElement; top: number; height: number };

const FPS = 24;
// Page px per second of "footage": the timecode runs with the scroll.
const PX_PER_SECOND = 420;

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
function timecode(y: number) {
  const frames = Math.max(0, Math.round((y / PX_PER_SECOND) * FPS));
  const ff = frames % FPS;
  const total = Math.floor(frames / FPS);
  return `${pad(total / 3600)}:${pad((total / 60) % 60)}:${pad(total % 60)}:${pad(ff)}`;
}

/**
 * The whole site seen through a camera: viewfinder corners and readouts around the screen, and
 * at the foot a timeline of the page's scenes (every element carrying `data-scene`), sized to
 * each section's length, with a playhead and a timecode that run with the scroll. A scene
 * segment jumps there. Over the hero (it has its own viewfinder and clock strip) the frame
 * steps aside and only the timeline stays.
 */
export default function RecordingHud() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const [scenes, setScenes] = useState<{ name: string; share: number }[]>([]);
  const [current, setCurrent] = useState(0);
  const [inHero, setInHero] = useState(true);
  const sceneData = useRef<Scene[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let last = { current: -1, hero: true };

    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
      const docH = Math.max(1, root.scrollHeight);
      sceneData.current = els.map((el) => {
        // A pinned section's scroll length lives on its pin spacer.
        const box = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
        const r = box.getBoundingClientRect();
        return { name: el.dataset.scene || "", el, top: r.top + window.scrollY, height: r.height };
      });
      setScenes(sceneData.current.map((s) => ({ name: s.name, share: s.height / docH })));
      update();
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, y / max));
      const track = trackRef.current;
      if (track && headRef.current) headRef.current.style.transform = `translateX(${(p * track.clientWidth).toFixed(1)}px)`;
      if (tcRef.current) tcRef.current.textContent = timecode(y);
      // The scene under the screen's middle.
      const mid = y + window.innerHeight / 2;
      let idx = 0;
      sceneData.current.forEach((s, i) => {
        if (mid >= s.top) idx = i;
      });
      if (idx !== last.current) {
        last.current = idx;
        setCurrent(idx);
      }
      const hero = !!sceneData.current[idx]?.el.hasAttribute("data-hero");
      if (hero !== last.hero) {
        last.hero = hero;
        setInHero(hero);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Sections change height as fonts load and pins are set up; re-measure when the page does.
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const settle = window.setTimeout(measure, 600);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [pathname]);

  const jump = (i: number) => {
    const s = sceneData.current[i];
    if (!s) return;
    const lenis = (window as Window & { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(s.top, { duration: 1.6 });
    else window.scrollTo({ top: s.top, behavior: "smooth" });
  };

  const scene = scenes[current];

  return (
    <>
      <div className={styles.frame} data-hidden={inHero || undefined} aria-hidden="true">
        <i className={`${styles.corner} ${styles.tl}`} />
        <i className={`${styles.corner} ${styles.tr}`} />
        <i className={`${styles.corner} ${styles.bl}`} />
        <i className={`${styles.corner} ${styles.br}`} />
        <i className={`${styles.tick} ${styles.tickTop}`} />
        <i className={`${styles.tick} ${styles.tickBottom}`} />
        <p className={`${styles.readout} ${styles.left}`}>
          <span className={styles.rec} />
          <b>Rec</b> — Dandy cam · A-roll
        </p>
        <p className={`${styles.readout} ${styles.right}`}>
          2.39:1 · 24 fps · <b>Sc {pad(current)}</b>
        </p>
      </div>

      <nav ref={barRef} className={styles.bar} aria-label="Page scenes">
        <span className={styles.tc}>
          TC <span ref={tcRef}>00:00:00:00</span>
        </span>
        <div ref={trackRef} className={styles.track}>
          {scenes.map((s, i) => (
            <button
              key={i}
              type="button"
              className={styles.segment}
              data-current={i === current || undefined}
              style={{ flexGrow: s.share }}
              onClick={() => jump(i)}
              aria-label={`Scene ${pad(i)}: ${s.name}`}
              aria-current={i === current ? "true" : undefined}
            >
              {pad(i)}
            </button>
          ))}
          <span ref={headRef} className={styles.head} aria-hidden="true" />
        </div>
        <span className={styles.now} aria-live="polite">
          <b>
            Sc {pad(current)} / {pad(Math.max(0, scenes.length - 1))}
          </b>
          <span>{scene?.name ?? ""}</span>
        </span>
      </nav>
    </>
  );
}
