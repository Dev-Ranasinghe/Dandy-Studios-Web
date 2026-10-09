"use client";

import { forwardRef, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import GlassLayer from "@/components/ui/GlassLayer";
import type { Package, Rich } from "@/components/focus";
import styles from "./Ticket.module.css";

export function RichText({ value }: { value: Rich }) {
  return (
    <>
      {value.map((part, i) => (typeof part === "string" ? part : <em key={i}>{part.em}</em>))}
    </>
  );
}

/** Bar widths from the package's id, so each ticket prints its own code. */
function bars(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 96) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const w = 1 + ((h >>> 3) & 3) * 0.7;
    const gap = 0.8 + ((h >>> 7) & 3) * 0.6;
    out.push({ x, w });
    x += w + gap;
  }
  return { bars: out, width: x };
}

function Barcode({ seed }: { seed: string }) {
  const { bars: list, width } = bars(seed);
  return (
    <svg className={styles.barcode} viewBox={`0 0 ${width.toFixed(1)} 20`} preserveAspectRatio="none" aria-hidden="true">
      {list.map((b, i) => (
        <rect key={i} x={b.x.toFixed(2)} width={b.w.toFixed(2)} height="20" />
      ))}
    </svg>
  );
}

const NOTCH = 0.045; // perforation notch radius, share of the ticket width
const RADIUS = 0.055; // corner radius, share of the width
const TOOTH = 9; // torn-edge tooth pitch, px

/** The body: rounded top corners, a half notch cut into each bottom corner at the perforation. */
function bodyPath(w: number, h: number) {
  const r = w * RADIUS;
  const n = w * NOTCH;
  return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - n}A${n} ${n} 0 0 0 ${w - n} ${h}H${n}A${n} ${n} 0 0 0 0 ${h - n}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

/** The stub: notched top corners, a toothed top edge where it tears off, rounded foot. */
function stubPath(w: number, h: number) {
  const r = w * RADIUS;
  const n = w * NOTCH;
  const span = w - 2 * n;
  const count = Math.max(4, Math.round(span / TOOTH));
  const step = span / count;
  let top = "";
  for (let i = 0; i < count; i++) {
    const x = n + i * step;
    top += `L${(x + step / 2).toFixed(2)} 3L${(x + step).toFixed(2)} 0`;
  }
  return `M${n} 0${top}A${n} ${n} 0 0 0 ${w} ${n}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${n}A${n} ${n} 0 0 0 ${n} 0Z`;
}

type Props = { pkg: Package; index: number; className?: string };

/**
 * One package as a ticket. Hover or focus tears the stub along the perforation: it drops and
 * swings on its corner, and the barcode gives way to the call to action. On phones the scroll
 * timeline tears it instead (it drives --rip directly).
 */
const Ticket = forwardRef<HTMLElement, Props>(function Ticket({ pkg, index, className }, ref) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stubRef = useRef<HTMLDivElement>(null);

  // The outline is cut with clip-path paths sized from the real box, like the original ticket.
  useEffect(() => {
    const body = bodyRef.current;
    const stub = stubRef.current;
    if (!body || !stub) return;
    const ro = new ResizeObserver(() => {
      const w = body.offsetWidth;
      // The shape is applied to the glass layer, not the parts themselves: a clipped
      // ancestor would bound what the glass can see to the ticket alone, hiding the wave behind it.
      body.style.setProperty("--clip", `path('${bodyPath(w, body.offsetHeight)}')`);
      stub.style.setProperty("--clip", `path('${stubPath(w, stub.offsetHeight)}')`);
    });
    ro.observe(body);
    ro.observe(stub);
    return () => ro.disconnect();
  }, []);

  return (
    <article ref={ref} className={`${styles.ticket} ${className ?? ""}`} aria-labelledby={`pkg-${pkg.id}`}>
      <div ref={bodyRef} className={styles.body}>
        <GlassLayer look="bar" radius={14} frost={0} />
        <h3 id={`pkg-${pkg.id}`} className={styles.name}>
          {pkg.name}
        </h3>
        <p className={styles.pitch}>
          <RichText value={pkg.pitch} />
        </p>
        <ul className={styles.features}>
          {pkg.features.map((f, i) => (
            <li key={i}>
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <path d="M5 0.6 9.4 5 5 9.4 0.6 5Z" />
              </svg>
              <span>
                <RichText value={f} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div ref={stubRef} className={styles.stub}>
        <GlassLayer look="bar" radius={14} frost={0} />
        <p className={styles.priceRow}>
          <span className={styles.caps}>Price starts at</span>
          <span className={styles.price}>{pkg.price}</span>
        </p>
        <div className={styles.swap}>
          <Barcode seed={pkg.id} />
          <a className={`${styles.call} glass-host glass-solid`} href="/contact">
            <GlassLayer />
            Schedule a free call
            <ArrowRight aria-hidden="true" strokeWidth={2} />
          </a>
        </div>
        <p className={`${styles.caps} ${styles.motto}`}>{pkg.motto}</p>
      </div>
    </article>
  );
});

export default Ticket;
