"use client";

import { useSyncExternalStore } from "react";
import { ACCENTS, ACCENT_EVENT, ACCENT_KEY, DEFAULT_ACCENT, isAccent, type Accent, type AccentPalette } from "./accent-palette";

export * from "./accent-palette";

export function getAccent(): Accent {
  if (typeof document === "undefined") return DEFAULT_ACCENT;
  const value = document.documentElement.dataset.accent;
  return isAccent(value) ? value : DEFAULT_ACCENT;
}

export function setAccent(accent: Accent) {
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) delete root.dataset.accent;
  else root.dataset.accent = accent;
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {}
  window.dispatchEvent(new Event(ACCENT_EVENT));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(ACCENT_EVENT, onChange);
  return () => window.removeEventListener(ACCENT_EVENT, onChange);
};

/** The current accent's name; re-renders when the visitor picks another. */
export function useAccentName(): Accent {
  return useSyncExternalStore(subscribe, getAccent, () => DEFAULT_ACCENT);
}

/** The current accent's palette, for canvas and WebGL pieces. */
export function useAccent(): AccentPalette {
  return ACCENTS[useAccentName()];
}
