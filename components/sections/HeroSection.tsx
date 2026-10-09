"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import cutout from "@/public/images/portrait-cutout.webp";
import HeroCursorField, { type CursorFieldHandle } from "@/components/ui/hero-cursor-field";
import HeroCamera, { type CameraStatus, type StartStage } from "./HeroCamera";
import ExperienceGate from "./ExperienceGate";
import { MENU_OPEN_EVENT } from "@/components/SiteHeader";
import { onSoundChange, toggleSound as toggleMusic, tick } from "@/lib/hero-sound";
import { wait, whenSettled } from "@/lib/settle";
import GlassLayer from "@/components/ui/GlassLayer";
import styles from "./HeroSection.module.css";

const COLUMNS = 8;
const ROWS = 4;
// Grid crossings that carry a small square, as in the reference: [column line, row line].
const MARKS = [
  [6, 1],
  [5, 2],
  [6, 3],
  [4, 3],
];

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
  off: "Off",
  starting: "Starting",
  active: "Active",
  blocked: "Blocked",
  missing: "No camera",
  unsupported: "Unavailable",
};

const STATUS_NOTE: Partial<Record<CameraStatus, string>> = {
  blocked: "Camera access was denied. Allow it in the address bar, then switch on again.",
  missing: "No camera was found on this device.",
  unsupported: "This browser can't open the camera here.",
};

/** "GMT + 5:30" for any IANA zone (or the visitor's own), from the zone's current offset. */
function gmtLabel(date: Date, timeZone?: string) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const [, sign = "+", rest = "0"] = part?.match(/GMT([+-])?(.*)/) ?? [];
  return `GMT ${sign} ${rest || "0"}`;
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** The ticking clocks on their own, so only this strip re-renders every second. */
function Clocks() {
  const now = useNow();
  const time = (timeZone?: string) =>
    now
      ? new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)
      : "--:--:--";

  return (
    <p className={styles.clocks}>
      <span>
        <span className={styles.dim}>Local hour:</span>{" "}
        <time suppressHydrationWarning>
          {time()} [{now ? gmtLabel(now) : "GMT"}]
        </time>
      </span>
      <span>
        <span className={styles.dim}>USA hour:</span>{" "}
        <time suppressHydrationWarning>
          {time("America/New_York")} [{now ? gmtLabel(now, "America/New_York") : "GMT"}]
        </time>
      </span>
    </p>
  );
}

function SoundBars({ on }: { on: boolean }) {
  return (
    <span className={styles.bars} data-on={on} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ "--b": i } as React.CSSProperties} />
      ))}
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
   * (any link or button outside the hero's own switches, a scroll, the menu) is held and
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
      if (!el || (section?.contains(el) && el.closest(`.${styles.controls}`))) return;
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

    document.addEventListener("click", onClick, true);
    window.addEventListener("wheel", holdScroll, { passive: false });
    window.addEventListener("touchmove", holdScroll, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(MENU_OPEN_EVENT, onMenu);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("wheel", holdScroll);
      window.removeEventListener("touchmove", holdScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(MENU_OPEN_EVENT, onMenu);
    };
  }, [experience, shutting, shutDown]);


  return (
    <section ref={sectionRef} className={styles.hero} aria-label="Dandy Studios" data-hero>
      <div ref={frameRef} className={styles.frame} data-camera={camera === "active" || undefined}>
        {/* Ground: dusk gradient and the founder, multiplied into it. */}
        <div className={styles.field} aria-hidden="true">
          <Image
            src={cutout}
            alt=""
            priority
            className={styles.figure}
            sizes="(max-width: 720px) 110vw, 46vw"
          />
        </div>

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

        <div className={styles.grid} aria-hidden="true" style={{ "--cols": COLUMNS, "--rows": ROWS } as React.CSSProperties}>
          {MARKS.map(([c, r]) => (
            <span key={`${c}-${r}`} style={{ "--c": c, "--r": r } as React.CSSProperties} />
          ))}
        </div>
        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.corners} aria-hidden="true" />

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

        <HeroCursorField
          ref={fieldRef}
          host={frameRef}
          wide={camera === "active"}
          className={styles.cursorField}
        />

        {/* The floating site header sits over this row, at the top of the frame; the clock strip follows. */}
        <div className={styles.navSpace} aria-hidden="true" />

        <div className={styles.strip}>
          <Clocks />
          <p className={styles.touch}>
            <span className={styles.dim}>Get in touch:</span> <a href="/contact">Start a project</a>
          </p>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            role="switch"
            aria-checked={cameraOn}
            aria-describedby={note ? "hero-camera-note" : undefined}
            className={styles.switch}
            onClick={toggleExperience}
            onPointerEnter={() => tick()}
            data-state={camera}
          >
            <span className={styles.switchText}>
              <span className={styles.switchName}>Experience</span>
              <span className={styles.switchValue} aria-live="polite">
                {STATUS_LABEL[camera]}
              </span>
            </span>
            <span className={`${styles.track} glass-host`} aria-hidden="true">
              <GlassLayer />
              <span className={styles.knob} />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={sound}
            className={styles.sound}
            onClick={toggleSound}
            onPointerEnter={() => tick()}
          >
            <SoundBars on={sound} />
            <span className={styles.switchText}>
              <span className={styles.switchName}>Sound</span>
              <span className={styles.switchValue}>{sound ? "On" : "Off"}</span>
            </span>
          </button>

          {note && (
            <p id="hero-camera-note" className={styles.note} role="status">
              {note}
            </p>
          )}
        </div>

        <div className={styles.intro}>
          <div className={styles.role}>
            <p className={styles.index}>[ 001.1 ]</p>
            <p className={styles.roleTitle}>
              Creative Branding{" "}
              <br />
              Agency
            </p>
          </div>
          <div className={styles.pitch}>
            <p className={styles.index}>[ 001.2 ]</p>
            <p className={styles.pitchText}>
              I design and build websites for brands that want to be felt, not just seen: strategy, interface and
              code from one studio.
            </p>
          </div>
          <p className={styles.copyright}>©2026 Dandy Studios</p>
        </div>

        <div className={styles.head}>
          <h1 className={styles.headline}>
            <span className={styles.line}>More Dandyyy. </span>
            <span className={styles.line}>Less Ordinaryyy.</span>
          </h1>
        </div>
      </div>
    </section>
  );
}
