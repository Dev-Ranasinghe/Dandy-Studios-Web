"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HeroCursorField, { type CursorFieldHandle } from "@/components/ui/hero-cursor-field";
import HeroCamera, { type CameraStatus, type StartStage } from "./HeroCamera";
import ExperienceGate from "./ExperienceGate";
import HeroSnake from "./HeroSnake";
import { MENU_OPEN_EVENT } from "@/components/SiteHeader";
import { ACCENTS, setAccent, useAccentName, type Accent } from "@/lib/accent";
import { onSoundChange, toggleSound as toggleMusic, tick } from "@/lib/hero-sound";
import { wait, whenSettled } from "@/lib/settle";
import { SCROLL_HELD_ATTR } from "@/components/SmoothScroll";
import styles from "./HeroSection.module.css";

// The shortest the lens stays up on the way in and out; each also waits for the page to settle.
const BOOT_MS = 1800;
const SHUTDOWN_MS = 1600;

const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);
const STAGE_TEXT: Record<StartStage, string> = {
  runtime: "Loading the vision runtime",
  model: "Downloading the hand model",
  compile: "Compiling on your device",
  camera: "Waiting for your camera",
  warm: "Focusing",
  ready: "Ready",
};

type Gate = {
  mode: "start" | "stop";
  progress: number;
  stage: string;
  ending: boolean;
  snapshot?: HTMLCanvasElement | null;
} | null;

/** The camera's current frame, mirrored and downscaled, to freeze under the closing lens. */
function snapshotOf(video: HTMLVideoElement | null | undefined) {
  if (!video || !video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = Math.round((640 * video.videoHeight) / video.videoWidth);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

const STATUS_LABEL: Record<CameraStatus, string> = {
  off: "off",
  starting: "starting",
  active: "on",
  blocked: "blocked",
  missing: "no camera",
  unsupported: "unavailable",
};

const STATUS_NOTE: Partial<Record<CameraStatus, string>> = {
  blocked: "Camera access was denied. Allow it in the address bar, then switch on again.",
  missing: "No camera was found on this device.",
  unsupported: "This browser can't open the camera here.",
};

/** "2:34 pm" for any IANA zone (or the visitor's own). */
const clock = (date: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(date)
    .toLowerCase();

/** The ticking clocks on their own, so only these lines re-render. */
function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className={`${styles.group} ${styles.clocks}`}>
      <span className={styles.pair}>
        <span className={styles.key}>local:</span>
        <time suppressHydrationWarning>{now ? clock(now) : "--:--"}</time>
      </span>
      <span className={styles.pair}>
        <span className={styles.key}>new york:</span>
        <time suppressHydrationWarning>{now ? clock(now, "America/New_York") : "--:--"}</time>
      </span>
    </p>
  );
}

const THEMES = Object.keys(ACCENTS) as Accent[];

/** "©26": the current year, so the tag never goes stale. */
function Year() {
  return <span suppressHydrationWarning>[©{String(new Date().getFullYear()).slice(-2)}]</span>;
}

/** The poster's words, placed by CSS. Rendered once as the type and twice for the glitch. */
function Words({ className, "data-ghost": ghost }: { className: string; "data-ghost"?: string }) {
  return (
    <span className={className} data-ghost={ghost} aria-hidden="true">
      <span className={styles.word} data-w="more">More</span>
      <span className={styles.word} data-w="dandy">Dandy</span>
      <span className={styles.word} data-w="yyy">yyy</span>
      <span className={styles.word} data-w="less">Less</span>
      <span className={styles.word} data-w="ordin">
        <span className={styles.ring}>O</span>rdin
      </span>
      <span className={styles.word} data-w="aryyy">aryyy</span>
    </span>
  );
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<CursorFieldHandle>(null);

  const [experience, setExperience] = useState(false);
  const [camera, setCamera] = useState<CameraStatus>("off");
  const [sound, setSoundOn] = useState(false);
  const [shutting, setShutting] = useState(false);
  const [gate, setGate] = useState<Gate>(null);
  const bootStartRef = useRef(0);
  const shuttingRef = useRef(false);
  const replayRef = useRef<HTMLElement | null>(null);
  const cameraLiveRef = useRef(false);
  cameraLiveRef.current = experience && !shuttingRef.current;

  const cameraOn = camera === "starting" || camera === "active";
  const theme = useAccentName();
  const nextTheme = () => {
    tick(1180, 0.06);
    setAccent(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  };
  const note = STATUS_NOTE[camera];

  /*
   * Leaving camera mode, from the switch or from any attempt to leave the hero. The camera and
   * tracker stop at once, under a closing lens over the camera's last frame. The page is let go
   * (and a held click replayed) only after the minimum time and once frames are smooth again.
   */
  const shutDown = useCallback((target: HTMLElement | null) => {
    replayRef.current ??= target;
    if (shuttingRef.current) return;
    shuttingRef.current = true;
    cameraLiveRef.current = false;
    const snapshot = snapshotOf(frameRef.current?.querySelector("video"));
    setGate({ mode: "stop", progress: 0.66, stage: "Releasing the camera", ending: false, snapshot });
    setShutting(true);
    setExperience(false);
    setCamera("off");

    const step = (progress: number, stage: string, ending = false) =>
      setGate((g) => (g?.mode === "stop" ? { ...g, progress, stage, ending } : g));
    (async () => {
      await wait(500);
      step(0.33, "Stopping hand tracking");
      await wait(500);
      step(0.08, "Settling the page");
      await wait(SHUTDOWN_MS - 1000);
      await whenSettled();
      step(0, "Back to normal", true);
    })();
  }, []);

  const toggleExperience = () => {
    if (gate) return; // mid-transition: the lens finishes first
    tick(experience ? 660 : 990, 0.08);
    if (experience) {
      shutDown(null);
      return;
    }
    bootStartRef.current = performance.now();
    setGate({ mode: "start", progress: 0.02, stage: STAGE_TEXT.runtime, ending: false });
    setExperience(true);
  };

  const onProgress = useCallback((p: number, stage: StartStage, bytes?: { loaded: number; total: number }) => {
    const text = stage === "model" && bytes ? `${STAGE_TEXT.model} · ${mb(bytes.loaded)} / ${mb(bytes.total)} MB` : STAGE_TEXT[stage];
    setGate((g) => (g?.mode === "start" && !g.ending ? { ...g, progress: Math.max(g.progress, p), stage: text } : g));
  }, []);

  // The lens opens once the camera is live, the minimum time has passed and the page has settled.
  const onReady = useCallback(async () => {
    await wait(Math.max(0, BOOT_MS - (performance.now() - bootStartRef.current)));
    await whenSettled();
    setGate((g) => (g?.mode === "start" ? { ...g, progress: 1, stage: STAGE_TEXT.ready, ending: true } : g));
  }, []);

  const gateModeRef = useRef<"start" | "stop" | null>(null);
  gateModeRef.current = gate?.mode ?? null;
  const onGateDone = useCallback(() => {
    const wasStop = gateModeRef.current === "stop";
    gateModeRef.current = null;
    setGate(null);
    if (!wasStop) return;
    shuttingRef.current = false;
    setShutting(false);
    const el = replayRef.current;
    replayRef.current = null;
    // Replayed after the hold's listeners are gone, so it goes through as a normal click.
    window.setTimeout(() => el?.click(), 0);
  }, []);

  // The switch mirrors the site's one music player (the nav bar's music button drives it too).
  useEffect(() => onSoundChange(({ on }) => setSoundOn(on)), []);
  const toggleSound = () => {
    toggleMusic();
    window.setTimeout(() => tick(1320), 120);
  };

  const onStatus = useCallback((status: CameraStatus) => {
    setCamera(status);
    if (status !== "starting" && status !== "active") {
      setExperience(false);
      setGate((g) => (g?.mode === "start" ? null : g));
    }
  }, []);

  const onFingertip = useCallback((point: { x: number; y: number } | null) => {
    fieldRef.current?.setHand(point);
  }, []);

  /*
   * The camera is for the hero only. While it runs (or starts), the first attempt to leave
   * (any link or button outside the hero's `free` switches, a scroll, the menu) is held and
   * turned into a shutdown; the click is replayed once the page is back to normal.
   */
  useEffect(() => {
    if (!experience && !shutting) return;
    const section = sectionRef.current;
    // Handlers can outlive the state by a render; these refs say whether to hold anything at all.
    const holding = () => cameraLiveRef.current || shuttingRef.current;

    const onClick = (e: MouseEvent) => {
      if (!holding()) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>("a, button");
      if (!el || (section?.contains(el) && el.closest(`.${styles.free}`))) return;
      e.preventDefault();
      e.stopPropagation();
      shutDown(el);
    };
    const holdScroll = (e: Event) => {
      if (!holding()) return;
      e.preventDefault();
      shutDown(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key) && !(e.target as Element | null)?.closest?.("input, textarea")) holdScroll(e);
    };
    // Fallbacks for anything that moves the page without a wheel or key (a scrollbar drag, the menu event).
    const startY = window.scrollY;
    const onScroll = () => {
      if (holding() && Math.abs(window.scrollY - startY) > 24) shutDown(null);
    };
    const onMenu = () => holding() && shutDown(null);

    // The eased scroll stands aside while the gate holds the page (see SmoothScroll.tsx).
    document.documentElement.setAttribute(SCROLL_HELD_ATTR, "");
    document.addEventListener("click", onClick, true);
    window.addEventListener("wheel", holdScroll, { passive: false });
    window.addEventListener("touchmove", holdScroll, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(MENU_OPEN_EVENT, onMenu);
    return () => {
      document.documentElement.removeAttribute(SCROLL_HELD_ATTR);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("wheel", holdScroll);
      window.removeEventListener("touchmove", holdScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(MENU_OPEN_EVENT, onMenu);
    };
  }, [experience, shutting, shutDown]);


  return (
    <section ref={sectionRef} className={styles.hero} aria-label="Dandy Studios" data-hero data-scene="Opening">
      <div ref={frameRef} className={styles.frame} data-camera={camera === "active" || undefined}>
        {experience && (
          <HeroCamera
            onStatus={onStatus}
            onFingertip={onFingertip}
            onProgress={onProgress}
            onReady={onReady}
            videoClassName={styles.video}
            canvasClassName={styles.hands}
          />
        )}

        <HeroCursorField ref={fieldRef} host={frameRef} wide={camera === "active"} className={styles.cursorField} />

        {/* The poster: the studio's line broken across the screen, the snake crawling through it. */}
        <h1 className={styles.type}>
          <span className="sr-only">More Dandyyy. Less Ordinaryyy.</span>
          <Words className={styles.words} />
          {/* Two torn copies, shown only in the glitch's brief bursts. */}
          <Words className={`${styles.words} ${styles.ghost}`} data-ghost="a" />
          <Words className={`${styles.words} ${styles.ghost}`} data-ghost="b" />
          <HeroSnake
            className={styles.snake}
            bodyClass={styles.snakeBody}
            blur={0.014}
          />
        </h1>

        <div className={styles.notes}>
          <p className={styles.pitch}>
            <span className={styles.glyph} aria-hidden="true">&gt;&gt;</span>
            <span className={styles.lines}>
              <span>i design + build</span>
              <span>websites for brands</span>
              <span>that want to be</span>
              <span>felt, not just seen</span>
            </span>
          </p>

          <span className={styles.slash} aria-hidden="true">://</span>

          <ul className={styles.tags}>
            <li data-t="role">
              creative
              <br />
              branding
            </li>
            <li data-t="year">
              <Year />
            </li>
            <li data-t="design">
              <span className={styles.glyph} aria-hidden="true">&gt;&gt;</span>
              <span>
                designin&rsquo;
                <br />
                websites
              </span>
            </li>
            <li data-t="build">
              <span className={styles.glyph} aria-hidden="true">://</span>
              <span>
                buildin&rsquo;
                <br />
                feelings
              </span>
            </li>
          </ul>
        </div>

        {gate && (
          <ExperienceGate
            mode={gate.mode}
            progress={gate.progress}
            stage={gate.stage}
            ending={gate.ending}
            snapshot={gate.snapshot}
            onDone={onGateDone}
          />
        )}

        <div className={styles.corners} aria-hidden="true" />

        {/* The foot: the hero's own switches and clocks, set as plain lines of type. */}
        <div className={styles.foot}>
          <div className={`${styles.group} ${styles.controls} ${styles.free}`}>
            <button
              type="button"
              role="switch"
              aria-checked={sound}
              className={styles.pair}
              onClick={toggleSound}
              onPointerEnter={() => tick()}
            >
              <span className={styles.key}>sound</span>
              <span className={styles.value}>[{sound ? "on" : "off"}]</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={cameraOn}
              aria-describedby={note ? "hero-camera-note" : undefined}
              className={styles.pair}
              onClick={toggleExperience}
              onPointerEnter={() => tick()}
              data-state={camera}
            >
              <span className={styles.key}>camera</span>
              <span className={styles.value} aria-live="polite">
                [{STATUS_LABEL[camera]}]
              </span>
            </button>
            {note && (
              <p id="hero-camera-note" className={styles.note} role="status">
                {note}
              </p>
            )}
          </div>

          <Clocks />

          <div className={`${styles.group} ${styles.corner}`}>
            <button
              type="button"
              className={`${styles.pair} ${styles.free}`}
              onClick={nextTheme}
              onPointerEnter={() => tick()}
              aria-label={`Colour theme: ${ACCENTS[theme].label}. Switch to ${ACCENTS[THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]].label}`}
            >
              <span className={styles.key}>theme</span>
              <span className={styles.value}>[{ACCENTS[theme].label.toLowerCase()}]</span>
            </button>
          </div>
        </div>

        {/* The tube: scan lines, an aperture grille and a dark rim over everything. */}
        <div className={styles.screen} aria-hidden="true" />
      </div>
    </section>
  );
}
