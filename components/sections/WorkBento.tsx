"use client";

import { useRef, useState } from "react";
import {
  Aperture,
  ArrowRight,
  Asterisk,
  BookOpen,
  Clapperboard,
  Code,
  Monitor,
  PenTool,
  type LucideIcon,
} from "lucide-react";
import { WORK, WORK_CATEGORIES, categoryLabel, type WorkPiece } from "@/components/work";
import GlassLayer from "@/components/ui/GlassLayer";
import styles from "./WorkBento.module.css";

const ICONS: Record<string, LucideIcon> = {
  all: Asterisk,
  web: Monitor,
  dev: Code,
  motion: Clapperboard,
  art: Aperture,
  brand: PenTool,
  cases: BookOpen,
};

// Same destinations as the footer's "Follow on" column.
const ELSEWHERE = [
  { label: "Instagram", href: "https://instagram.com/" },
  { label: "X", href: "https://x.com/" },
  { label: "LinkedIn", href: "https://linkedin.com/" },
];

/** One piece: its still, and the clip playing over it while a mouse rests on it. */
function Piece({ piece }: { piece: WorkPiece }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const start = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const video = videoRef.current;
    if (!video) return;
    if (!video.src) video.src = piece.video; // clips load only when first wanted
    video.play().then(() => setPlaying(true)).catch(() => {});
  };
  const stop = () => {
    videoRef.current?.pause();
    setPlaying(false);
  };

  return (
    <li className={styles.piece}>
      <figure>
        <div className={styles.media} data-playing={playing || undefined} onPointerEnter={start} onPointerLeave={stop}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={piece.poster} alt="" loading="lazy" decoding="async" />
          <video ref={videoRef} muted loop playsInline preload="none" aria-hidden="true" />
        </div>
        <figcaption className={styles.caption}>
          <span className={styles.title}>{piece.title}</span>
          <span className={styles.tags}>
            {piece.categories.map((id) => (
              <span key={id} className={styles.tag}>
                {categoryLabel(id)}
              </span>
            ))}
          </span>
          <span className={styles.index}>( {piece.id} )</span>
        </figcaption>
      </figure>
    </li>
  );
}

/**
 * The work index as a bento: a dark sidebar of disciplines beside a dark panel of pieces.
 * The panel scrolls on its own, as far as the pieces go, then hands the wheel back to the page.
 */
export default function WorkBento() {
  const [active, setActive] = useState("all");
  const sectionRef = useRef<HTMLElement>(null);
  const pieces = active === "all" ? WORK : WORK.filter((p) => p.categories.includes(active));

  // A new filter starts from the first piece: bring the top of the index back into view if it has scrolled away.
  const choose = (id: string) => {
    setActive(id);
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top, behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} className={styles.bento} aria-labelledby="work-index">
      <aside className={styles.sidebar}>
        <p className={styles.brand}>
          <span className={styles.brandFull}>Dandy Studios</span>
          <span className={styles.brandMark} aria-hidden="true">
            D.
          </span>
        </p>

        <h2 id="work-index" className={styles.groupLabel}>
          Selected work
        </h2>
        <ul className={styles.cats}>
          {WORK_CATEGORIES.map((cat) => {
            const Icon = ICONS[cat.id] ?? Asterisk;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  className={`${styles.cat} glass-host`}
                  aria-pressed={active === cat.id}
                  disabled={cat.comingSoon}
                  onClick={() => choose(cat.id)}
                  title={cat.comingSoon ? `${cat.label}: coming soon` : cat.label}
                >
                  <GlassLayer />
                  <Icon aria-hidden="true" strokeWidth={1.6} />
                  <span className={styles.catLabel}>{cat.label}</span>
                  {cat.comingSoon && <span className={styles.soon}>Coming soon</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <p className={styles.groupLabel}>Also on</p>
        <ul className={styles.elsewhere}>
          {ELSEWHERE.map((link) => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className={styles.cta}>
          <p>Looking for something unique?</p>
          <a href="/contact" className={`${styles.ctaButton} glass-host glass-solid`}>
            <GlassLayer />
            Let&rsquo;s talk
            <ArrowRight aria-hidden="true" strokeWidth={2.2} />
          </a>
        </div>
      </aside>

      <div className={styles.panel} aria-live="polite" aria-label={`${categoryLabel(active)}, ${pieces.length} pieces`}>
        <ul className={styles.grid}>
          {pieces.map((piece) => (
            <Piece key={piece.id} piece={piece} />
          ))}
        </ul>
      </div>
    </section>
  );
}
