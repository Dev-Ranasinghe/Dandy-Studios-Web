"use client";

import { Glass } from "@samasante/liquid-glass";

/**
 * The site's liquid glass (@samasante/liquid-glass, material mode) as a layer under a control's
 * own content, so labels and icons stay crisp on top. Drop it in as the first child of anything
 * with the global `glass-host` class; it fills the host, takes its corner radius, and is tinted
 * by the host's `--glass-tint` (see globals.css). The page bends through it in Chrome/Edge and
 * frosts behind a bright rim everywhere else.
 */

export type GlassLook = "bar" | "control" | "pane";

/** A strong rim bend and a domed middle so the page pours through as it moves underneath. */
const OPTICS = {
  bar: {
    strength: 0.14,
    depth: 0.8,
    curvature: 0.55,
    bend: 0.9,
    bendWidth: 0.22,
    dispersion: 0.7,
    frost: 3,
    saturate: 1.2,
    sheen: 0.6,
    sheenWidth: 4,
    glow: 0.18,
  },
  // Buttons are small, so the same liquid look needs a wider rim band and a touch more frost.
  control: {
    strength: 0.16,
    depth: 0.85,
    curvature: 0.6,
    bend: 0.9,
    bendWidth: 0.28,
    dispersion: 0.6,
    frost: 4,
    saturate: 1.25,
    sheen: 0.7,
    sheenWidth: 3,
    glow: 0.2,
  },
  // Large panes that stay live (testimonial cards): the bar's bend and dome, but no colour
  // split. Dispersion runs the displacement three times; across a row of big panes over moving
  // beans that alone dropped frames, and without it the bend still reads as liquid.
  pane: {
    strength: 0.14,
    depth: 0.8,
    curvature: 0.55,
    bend: 0.9,
    bendWidth: 0.18,
    dispersion: 0,
    frost: 8,
    saturate: 1.3,
    sheen: 0.8,
    sheenWidth: 4,
    glow: 0.3,
  },
};

export default function GlassLayer({
  look = "control",
  radius,
  frost,
}: {
  look?: GlassLook;
  radius?: number;
  /** Overrides the look's frost (px), e.g. 0 for perfectly clear glass. */
  frost?: number;
}) {
  const optics = frost === undefined ? OPTICS[look] : { ...OPTICS[look], frost };
  return (
    <Glass className="glass-layer" radius={radius} optics={optics} aria-hidden="true">
      <span />
    </Glass>
  );
}
