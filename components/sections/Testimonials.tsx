"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TESTIMONIALS, type Testimonial } from "@/components/testimonials";
import GlassLayer from "@/components/ui/GlassLayer";
import MetaballsShader from "@/components/ui/metaballs-shader";
import styles from "./Testimonials.module.css";

// A gentle vertical rhythm for the cards, repeating every five, as in the reference.
const LIFTS = [0, 1, 0.35, -0.55, 0.6];
const SPEED = 76; // px per second while drifting

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Card({ t, index, hidden }: { t: Testimonial; index: number; hidden?: boolean }) {
  return (
    <li
      className={styles.item}
      style={{ "--lift": LIFTS[index % LIFTS.length] } as React.CSSProperties}
      aria-hidden={hidden || undefined}
    >
      {/* Light liquid glass: tinted at rest, refracting only under the pointer (see glass-calm). */}
      <figure className={`${styles.card} glass-host glass-calm`}>
        <GlassLayer look="pane" radius={12} />
        {/* Each run of text is a .hl span: on hover it is "selected" in the accent, sweeping line by line. */}
        <blockquote className={styles.quote}>
          <p>
            <span className={styles.hl}>{t.quote}</span>
          </p>
        </blockquote>
        <figcaption className={styles.person}>
          {t.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.avatar} src={t.photo} alt="" width={56} height={56} loading="lazy" />
          ) : (
            <span className={styles.avatar} aria-hidden="true">
              {initials(t.name)}
            </span>
          )}
          <span className={styles.who}>
            <span className={styles.name}>
              <span className={styles.hl}>{t.name}</span>
            </span>
            <span className={styles.role}>
              <span className={styles.hl}>{t.role}</span>
              <br />
              <span className={styles.hl}>{t.company}</span>
            </span>
          </span>
        </figcaption>
        <span className={styles.mark} aria-hidden="true">
          &rdquo;
        </span>
      </figure>
    </li>
  );
}

/**
 * Testimonials: a heading, then a row of glass cards drifting slowly left over the metaballs,
 * on every device. With a mouse the row holds still under the pointer or keyboard focus, a
 * highlight "drag" disc replaces the cursor, and the text of the card under it is "selected" in
 * the accent. Dragging (mouse or finger) throws the row either way; a finger on the row holds it,
 * and it drifts on again a moment after letting go. With reduced motion it is a plain row the
 * visitor swipes, snapping card by card.
 */
export default function Testimonials() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const [drift, setDrift] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setDrift(!reduce.matches);
    update();
    reduce.addEventListener("change", update);
    return () => reduce.removeEventListener("change", update);
  }, []);

  // The drift: one loop, only while on screen, easing to a stop under the pointer or focus.
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const disc = discRef.current;
    if (!drift || !viewport || !track || !disc) return;

    let offset = 0;
    let speed = SPEED;
    let target = SPEED;
    let last = performance.now();
    let frame = 0;
    let visible = false;
    let loop = 0;

    const measure = () => {
      // Distance from the first card to its copy: one full lap.
      const items = track.children;
      const half = items.length / 2;
      loop = half ? (items[half] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft : 0;
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      speed += (target - speed) * Math.min(1, dt * 4);
      if (!dragging) offset += speed * dt;
      if (loop > 0) offset = ((offset % loop) + loop) % loop;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      frame = visible ? requestAnimationFrame(step) : 0;
    };

    // Drag: the row follows the pointer; letting go throws it, and it eases to a stop.
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let fling = 0;
    // The disc is fixed to the window, so the row's clipping never cuts it at the edges.
    // Shown only while the pointer is really over the row: scrolling can carry the row away from
    // a still pointer, so every scroll re-checks what is under it.
    let px = -1;
    let py = -1;
    const show = (on: boolean) => {
      if (on) disc.dataset.show = "";
      else delete disc.dataset.show;
    };
    const moveDisc = (e: PointerEvent) => {
      // The disc is a cursor: mouse only. A finger just drags.
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      disc.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      show(true);
    };
    const onScroll = () => {
      if (px < 0) return;
      const under = document.elementFromPoint(px, py);
      const inside = !!under && viewport.contains(under);
      show(inside || dragging);
      if (!inside && !dragging) target = SPEED;
    };
    const onLeave = () => {
      if (!dragging) show(false);
    };
    const onMove = (e: PointerEvent) => {
      moveDisc(e);
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      offset -= dx;
      fling = (-dx / Math.max(now - lastT, 1)) * 1000;
      lastX = e.clientX;
      lastT = now;
    };
    let resumeTimer = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // A finger on the row holds it, as the mouse does by hovering.
      if (e.pointerType !== "mouse") {
        window.clearTimeout(resumeTimer);
        target = 0;
      }
      dragging = true;
      lastX = e.clientX;
      lastT = performance.now();
      fling = 0;
      viewport.setPointerCapture(e.pointerId);
      viewport.dataset.dragging = "";
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete viewport.dataset.dragging;
      speed = Math.max(-2400, Math.min(2400, fling));
      onScroll();
      // Touch has no hover to leave, so the drift picks up again on its own after a beat.
      if (e.pointerType !== "mouse") resumeTimer = window.setTimeout(() => (target = SPEED), 1400);
    };

    // Hover holds the row for the mouse only: on touch, :hover sticks after a tap.
    const hold = (e: Event) => {
      if (e instanceof PointerEvent && e.pointerType !== "mouse") return;
      target = 0;
    };
    const release = (e: Event) => {
      if (e instanceof PointerEvent && e.pointerType !== "mouse") return;
      if (!viewport.matches(":hover") && !viewport.contains(document.activeElement)) target = SPEED;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    });
    const ro = new ResizeObserver(measure);

    measure();
    io.observe(viewport);
    ro.observe(track);
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
    viewport.addEventListener("pointerenter", hold);
    viewport.addEventListener("pointerleave", release);
    viewport.addEventListener("focusin", hold);
    viewport.addEventListener("focusout", release);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer);
      io.disconnect();
      ro.disconnect();
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      viewport.removeEventListener("pointerenter", hold);
      viewport.removeEventListener("pointerleave", release);
      viewport.removeEventListener("focusin", hold);
      viewport.removeEventListener("focusout", release);
      track.style.transform = "";
    };
  }, [drift]);

  return (
    <section className={styles.testimonials} aria-labelledby="testimonials-heading">
      <header className={styles.header}>
        <p className={`${styles.label} marker`}>
          <span aria-hidden="true">( </span>Testimonials<span aria-hidden="true"> )</span>
        </p>
        <h2 id="testimonials-heading" className={styles.heading}>
          Don&rsquo;t take our word for it<span className={styles.star}>*</span>
        </h2>
        <p className={styles.aside}>
          <span className="marker-under">*Take theirs</span>
        </p>
      </header>

      <div
        ref={viewportRef}
        className={styles.viewport}
        data-mode={drift ? "drift" : "swipe"}
        role="region"
        aria-label="Client testimonials"
        tabIndex={drift ? undefined : 0}
      >
        {/* The metaballs glow behind the row; the glass cards drift over it. */}
        <MetaballsShader className={styles.band} />
        {drift && (
          <div ref={discRef} className={styles.disc} aria-hidden="true">
            <span>
              <ArrowLeft strokeWidth={2.2} />
              Drag
              <ArrowRight strokeWidth={2.2} />
            </span>
          </div>
        )}
        <ul ref={trackRef} className={styles.track}>
          {TESTIMONIALS.map((t, i) => (
            <Card key={i} t={t} index={i} />
          ))}
          {/* The drift loops over a second copy, hidden from assistive tech. */}
          {drift && TESTIMONIALS.map((t, i) => <Card key={`copy-${i}`} t={t} index={i} hidden />)}
        </ul>
      </div>
    </section>
  );
}
