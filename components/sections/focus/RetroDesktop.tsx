"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BatteryFull, Search, ToggleRight, UserRound, Wifi } from "lucide-react";
import { FAQ_MD, PHOTOS } from "@/components/focus";
import { TESTIMONIALS } from "@/components/testimonials";
import styles from "./RetroDesktop.module.css";

export type WinId = "pricing" | "testimonials" | "faq" | (typeof PHOTOS)[number]["id"];
export type DesktopHandle = {
  open: (id: WinId) => void;
  /** Closes every window and forgets where they were dragged (the Pricing window stays). */
  closeAll: () => void;
  /** The Pricing window's parts, for the zoom: the frame, its title bar, its body. */
  pricing: () => { win: HTMLElement | null; zoom: HTMLElement | null; bar: HTMLElement | null; body: HTMLElement | null };
};

type Place = { left: number; top: number; width: number; height?: number };
// Where each window first opens, in % of the desktop: [wide screens, phones].
const PLACES: Record<string, [Place, Place]> = {
  dandy: [{ left: 11, top: 7, width: 29 }, { left: 7, top: 5, width: 74 }],
  desk: [{ left: 30, top: 12, width: 24 }, { left: 14, top: 12, width: 66 }],
  process: [{ left: 40, top: 20, width: 24 }, { left: 20, top: 18, width: 66 }],
  testimonials: [{ left: 25, top: 29, width: 46, height: 50 }, { left: 4, top: 27, width: 88, height: 44 }],
  faq: [{ left: 61, top: 11, width: 28, height: 60 }, { left: 7, top: 45, width: 84, height: 38 }],
};

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return <span className={styles.clock}>&nbsp;</span>;
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
  return (
    <span className={styles.clock}>
      <time>{day}</time>
      <time>{time}</time>
    </span>
  );
}

/** Title bar controls: close is live; the other two are the era's decoration. */
function Controls({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <span className={styles.controls}>
      <button
        type="button"
        className={styles.close}
        aria-label={`Close ${label}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      />
      <span className={styles.hex} aria-hidden="true" />
      <span className={styles.diamond} aria-hidden="true" />
    </span>
  );
}

function FileIcon({ kind }: { kind: "md" | "html" }) {
  return (
    <svg viewBox="0 0 48 60" className={styles.fileGlyph} aria-hidden="true">
      <path d="M4 4H32L44 16V56H4Z" className={styles.filePaper} />
      <path d="M32 4V16H44" className={styles.fileFold} />
      <text x="24" y="44" textAnchor="middle">
        {kind.toUpperCase()}
      </text>
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 60 48" className={styles.folderGlyph} aria-hidden="true">
      <path d="M3 9C3 6 5 4 8 4H22L27 10H52C55 10 57 12 57 15V40C57 43 55 45 52 45H8C5 45 3 43 3 40Z" className={styles.folderBack} />
      <path d="M3 18C3 15 5 14 8 14H52C55 14 57 15 57 18V40C57 43 55 45 52 45H8C5 45 3 43 3 40Z" className={styles.folderFront} />
    </svg>
  );
}

function Testimonials() {
  const [active, setActive] = useState(0);
  const t = TESTIMONIALS[active];
  return (
    <div className={styles.chat}>
      <ul className={styles.people} role="listbox" aria-label="Clients" data-lenis-prevent>
        {TESTIMONIALS.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              className={styles.person}
              onClick={() => setActive(i)}
            >
              <UserRound aria-hidden="true" strokeWidth={1.8} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.company}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.thread} aria-live="polite" data-lenis-prevent>
        <p className={styles.from}>
          {t.name} ({t.company})
        </p>
        <div className={styles.bubbleRow}>
          <UserRound className={styles.bubbleAvatar} aria-hidden="true" strokeWidth={1.8} />
          <p className={styles.bubble}>{t.quote}</p>
        </div>
        <p className={styles.meta}>{t.role}</p>
      </div>
    </div>
  );
}

function Faq() {
  const lines = FAQ_MD.trimEnd().split("\n");
  return (
    <div className={styles.md} tabIndex={0} aria-label="FAQ.md" data-lenis-prevent>
      <ol>
        {lines.map((line, i) => (
          <li key={i} className={line.startsWith("#") ? styles.mdHeading : undefined}>
            {line || " "}
          </li>
        ))}
      </ol>
    </div>
  );
}

type Props = {
  /** The pricing scene, shown inside the Pricing window. */
  pricing: React.ReactNode;
  phone: boolean;
  /** True once the desktop is on screen: the Pricing window's chrome works from then on. */
  live: boolean;
};

/**
 * A desktop in the era of the TV it ends up inside. Files open windows; windows drag by their
 * title bars and come forward when touched. Leaving the desktop (scrolling back up to the
 * tickets, or down until the section is off screen) closes them all, via closeAll().
 */
const RetroDesktop = forwardRef<DesktopHandle, Props>(function RetroDesktop({ pricing, phone, live }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<WinId[]>([]);
  const [order, setOrder] = useState<WinId[]>(["pricing"]);
  const [pricingClosed, setPricingClosed] = useState(false);
  // Drag offsets survive closing and reopening a window.
  const offsets = useRef<Record<string, { x: number; y: number }>>({});

  const raise = useCallback((id: WinId) => {
    setOrder((o) => (o[o.length - 1] === id ? o : [...o.filter((w) => w !== id), id]));
  }, []);

  const openWin = useCallback(
    (id: WinId) => {
      if (id === "pricing") setPricingClosed(false);
      else setOpen((o) => (o.includes(id) ? o : [...o, id]));
      raise(id);
    },
    [raise],
  );
  const closeWin = (id: WinId) => {
    if (id === "pricing") setPricingClosed(true);
    else setOpen((o) => o.filter((w) => w !== id));
  };

  // Decode the photos ahead of time, so a window opening mid-scroll never stalls a frame on it.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    idle(() => PHOTOS.forEach((p) => {
      const img = new Image();
      img.src = p.src;
      img.decode().catch(() => {});
    }));
  }, []);

  // Scrolling back before the zoom hands the Pricing window back to the timeline: it must
  // fill the screen exactly again, so any drag is undone.
  useEffect(() => {
    if (live || !offsets.current.pricing) return;
    delete offsets.current.pricing;
    if (pricingRef.current) pricingRef.current.style.translate = "";
  }, [live]);

  useImperativeHandle(ref, () => ({
    open: openWin,
    closeAll: () => {
      setOpen([]);
      setPricingClosed(false);
      setOrder(["pricing"]);
      offsets.current = {};
      if (pricingRef.current) pricingRef.current.style.translate = "";
    },
    pricing: () => ({ win: pricingRef.current, zoom: zoomRef.current, bar: barRef.current, body: bodyRef.current }),
  }));

  /** Drags a window by its title bar, in desktop px whatever the desktop's own scale on screen. */
  const startDrag = (id: WinId) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const root = rootRef.current;
    const win = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-win]");
    if (!root || !win) return;
    raise(id);
    const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
    const start = { ...(offsets.current[id] ?? { x: 0, y: 0 }) };
    const sx = e.clientX;
    const sy = e.clientY;
    // Keep the bar on the desktop.
    const bounds = {
      minX: -win.offsetLeft - win.offsetWidth + 80,
      maxX: root.offsetWidth - win.offsetLeft - 80,
      minY: -win.offsetTop,
      maxY: root.offsetHeight - win.offsetTop - 48,
    };
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);
    win.dataset.dragging = "";
    const move = (ev: PointerEvent) => {
      const x = Math.min(bounds.maxX, Math.max(bounds.minX, start.x + (ev.clientX - sx) / scale));
      const y = Math.min(bounds.maxY, Math.max(bounds.minY, start.y + (ev.clientY - sy) / scale));
      offsets.current[id] = { x, y };
      win.style.translate = `${x}px ${y}px`;
    };
    const up = () => {
      delete win.dataset.dragging;
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  };

  const z = (id: WinId) => 10 + Math.max(0, order.indexOf(id));
  const placed = (id: string): React.CSSProperties => {
    const p = PLACES[id][phone ? 1 : 0];
    const o = offsets.current[id];
    return {
      left: `${p.left}%`,
      top: `${p.top}%`,
      width: `${p.width}%`,
      height: p.height ? `${p.height}%` : undefined,
      translate: o ? `${o.x}px ${o.y}px` : undefined,
      zIndex: z(id as WinId),
    };
  };

  const pricingOffset = offsets.current.pricing;

  return (
    <div ref={rootRef} className={styles.desktop} data-live={live ? "" : undefined}>
      {/* Files, down the right edge. */}
      <ul className={styles.icons} aria-label="Desktop">
        {PHOTOS.map((p) => (
          <li key={p.id}>
            <button type="button" className={styles.icon} onClick={() => openWin(p.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className={styles.thumb} loading="lazy" decoding="async" />
              <span>{p.file}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={styles.icon} onClick={() => openWin("testimonials")}>
            <FolderIcon />
            <span>Testimonials</span>
          </button>
        </li>
        <li>
          <button type="button" className={styles.icon} onClick={() => openWin("faq")}>
            <FileIcon kind="md" />
            <span>FAQ.md</span>
          </button>
        </li>
        <li>
          <button type="button" className={styles.icon} onClick={() => openWin("pricing")}>
            <FileIcon kind="html" />
            <span>Pricing.html</span>
          </button>
        </li>
      </ul>

      {/* The Pricing window starts as the whole screen; the scroll timeline zooms it down. */}
      <div
        ref={pricingRef}
        data-win
        className={`${styles.win} ${styles.pricingWin}`}
        data-closed={pricingClosed ? "" : undefined}
        style={{ zIndex: z("pricing"), translate: pricingOffset ? `${pricingOffset.x}px ${pricingOffset.y}px` : undefined }}
        role="region"
        aria-label="Pricing.html"
        onPointerDown={() => raise("pricing")}
      >
        <div ref={zoomRef} className={styles.zoom}>
          <div ref={barRef} className={styles.bar} onPointerDown={live ? startDrag("pricing") : undefined}>
            <Controls label="Pricing.html" onClose={() => closeWin("pricing")} />
            <span className={styles.title}>
              <strong>Pricing.html</strong>
            </span>
          </div>
          <div ref={bodyRef} className={styles.pricingBody}>
            {pricing}
          </div>
        </div>
      </div>

      {/* While the screen is the full-page pricing (scrolled back before the zoom), the other
          windows step aside; they come back exactly where they were left. */}
      <AnimatePresence>
        {open.map((id) => {
          const photo = PHOTOS.find((p) => p.id === id);
          const label = photo ? `${photo.title}, ${photo.role}` : id === "faq" ? "FAQ.md" : "Testimonials";
          return (
            <div
              key={id}
              data-win
              role="dialog"
              aria-label={label}
              className={styles.slot}
              style={placed(id)}
              onPointerDown={() => raise(id)}
            >
              <motion.div
                className={`${styles.win} ${photo ? styles.photoWin : styles.appWin}`}
                initial={{ opacity: 0, scale: 0.86, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 30 } }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
              >
                <div className={styles.bar} onPointerDown={startDrag(id)}>
                  <Controls label={label} onClose={() => closeWin(id)} />
                  <span className={styles.title}>
                    {photo ? (
                      <>
                        <strong>{photo.title}</strong> – {photo.role}
                      </>
                    ) : (
                      <strong>{id === "faq" ? "FAQ.md" : "Testimonials"}</strong>
                    )}
                  </span>
                </div>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.src} alt="" className={styles.photo} draggable={false} decoding="async" />
                ) : id === "faq" ? (
                  <Faq />
                ) : (
                  <Testimonials />
                )}
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>

      <div className={styles.taskbar} aria-hidden="true">
        <BatteryFull strokeWidth={1.8} />
        <ToggleRight strokeWidth={1.8} />
        <Search strokeWidth={1.8} />
        <Wifi strokeWidth={1.8} />
        <Clock />
      </div>
    </div>
  );
});

export default RetroDesktop;
