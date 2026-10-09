/**
 * The site's music. Muted by default: nothing loads or plays until the visitor turns it on,
 * from the nav bar's music button (or the hero's SOUND switch; both drive this one player).
 * One <audio> element plays the playlist in order, fading in and out; "next" changes track.
 * Small interface ticks (Web Audio) play only while the music is on.
 * Source files live in /Audio; the compressed copies served here are in public/audio/.
 */

export type Track = { src: string; title: string };

export const TRACKS: Track[] = [
  { src: "/audio/track-01.mp3", title: "Piano background — arpmedia" },
  { src: "/audio/track-02.mp3", title: "Background music — absolutesound" },
  { src: "/audio/track-03.mp3", title: "Titanium — Alegend" },
  { src: "/audio/track-04.mp3", title: "willow (instrumental) — Taylor Swift" },
];

const VOLUME = 0.55;
const FADE_MS = 700;

type State = { on: boolean; index: number };

let audio: HTMLAudioElement | null = null;
let index = 0;
let on = false;
let fadeFrame = 0;
const listeners = new Set<(state: State) => void>();

const emit = () => listeners.forEach((fn) => fn({ on, index }));

/** Subscribe to on/off and track changes; returns an unsubscribe function. */
export function onSoundChange(fn: (state: State) => void) {
  listeners.add(fn);
  fn({ on, index });
  return () => {
    listeners.delete(fn);
  };
}

function player() {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.volume = 0;
    audio.addEventListener("ended", () => load((index + 1) % TRACKS.length));
  }
  return audio;
}

function fadeTo(target: number, done?: () => void) {
  const el = player();
  cancelAnimationFrame(fadeFrame);
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / FADE_MS);
    el.volume = from + (target - from) * t;
    if (t < 1) fadeFrame = requestAnimationFrame(step);
    else done?.();
  };
  fadeFrame = requestAnimationFrame(step);
}

function play() {
  const el = player();
  el.volume = 0;
  void el
    .play()
    .then(() => fadeTo(VOLUME))
    .catch(() => {
      // Autoplay refused or the file failed: fall back to muted, so the UI never lies.
      on = false;
      emit();
    });
}

function load(i: number) {
  const el = player();
  index = i;
  el.src = TRACKS[i].src;
  if (on) play();
  emit();
}

/** Turn the music on or off (fades both ways). Call it from a click: browsers only start audio on a gesture. */
export function setSound(next: boolean) {
  if (next === on) return;
  on = next;
  const el = player();
  if (on) {
    if (!el.src) load(index);
    else play();
  } else if (!el.paused) {
    fadeTo(0, () => el.pause());
  }
  emit();
}

export function toggleSound() {
  setSound(!on);
}

/** Change to the next track (fades out, then in). Turns the music on if it was off. */
export function nextTrack() {
  const i = (index + 1) % TRACKS.length;
  if (!on) {
    index = i;
    if (audio) audio.src = TRACKS[i].src;
    setSound(true);
    return;
  }
  fadeTo(0, () => load(i));
}

// ---------- Interface ticks ----------

let ctx: AudioContext | null = null;

/** A short tick for hovers and switches; silent unless the music is on. */
export function tick(pitch = 1320, length = 0.05) {
  if (!on) return;
  ctx ??= new AudioContext();
  if (ctx.state !== "running") void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = pitch;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + length + 0.02);
}
