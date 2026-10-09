"use client";

import InteractiveListPreview from "@/components/ui/interactive-list-preview";
import PlasmaShader, { type PlasmaSettings } from "@/components/ui/plasma-shader";
import { useAccent } from "@/lib/accent";

// The plasma runs past this section into the ones above and below, fading out under a soft
// mask, so the moving colour itself dissolves into the paper instead of stopping at an edge.
// The fade follows a smoothstep curve (flat at both ends): a linear or steep ramp leaves a kink
// where it meets full strength, and the eye reads that kink as a line across the page.
// --bleed-up is the fade's length; --bleed-out is how far above the section it starts. On wide
// screens the plasma only peeks above its section, so the client names above sit on clear paper,
// and the long fade runs down inside the section (its heading sits mid-screen, on full colour).
// Where the section is content-height (≤1025px) its heading sits near the top, so most of the fade
// stays outside it; it starts at 0.8 of its length above, so it never reaches past the client
// marquee into the focus section's pinned stage (which would cut it with a hard line).
const BLEED_MASK = `linear-gradient(to bottom,
  transparent 0,
  rgb(0 0 0 / 0.028) calc(var(--bleed-up) * 0.1),
  rgb(0 0 0 / 0.104) calc(var(--bleed-up) * 0.2),
  rgb(0 0 0 / 0.216) calc(var(--bleed-up) * 0.3),
  rgb(0 0 0 / 0.352) calc(var(--bleed-up) * 0.4),
  rgb(0 0 0 / 0.5) calc(var(--bleed-up) * 0.5),
  rgb(0 0 0 / 0.648) calc(var(--bleed-up) * 0.6),
  rgb(0 0 0 / 0.784) calc(var(--bleed-up) * 0.7),
  rgb(0 0 0 / 0.896) calc(var(--bleed-up) * 0.8),
  rgb(0 0 0 / 0.972) calc(var(--bleed-up) * 0.9),
  #000 var(--bleed-up),
  #000 calc(100% - var(--bleed-down)),
  rgb(0 0 0 / 0.972) calc(100% - var(--bleed-down) * 0.9),
  rgb(0 0 0 / 0.896) calc(100% - var(--bleed-down) * 0.8),
  rgb(0 0 0 / 0.784) calc(100% - var(--bleed-down) * 0.7),
  rgb(0 0 0 / 0.648) calc(100% - var(--bleed-down) * 0.6),
  rgb(0 0 0 / 0.5) calc(100% - var(--bleed-down) * 0.5),
  rgb(0 0 0 / 0.352) calc(100% - var(--bleed-down) * 0.4),
  rgb(0 0 0 / 0.216) calc(100% - var(--bleed-down) * 0.3),
  rgb(0 0 0 / 0.104) calc(100% - var(--bleed-down) * 0.2),
  rgb(0 0 0 / 0.028) calc(100% - var(--bleed-down) * 0.1),
  transparent 100%)`;

// Hue rotation and the saturation boost are zeroed so the palette lands as sampled.
const BACKDROP_SETTINGS: Partial<PlasmaSettings> = {
  surface: [1.34, 1.04, 0.03, 1.0],
  finish: [0, 0.18, 0.039, 0.01],
};

export default function ListPreviewSection() {
  // Plasma backdrop in the current accent: near-black, deep, the tint, and a cool foil
  // (violet's was sampled from the reference). A theme change crossfades inside the shader.
  const accent = useAccent();
  const backdrop = [accent.plasma, accent.deep, accent.lavender, accent.counter];

  return (
    <section className="relative isolate flex h-screen w-full flex-col items-center justify-center gap-[var(--space-2xl)] px-[var(--gutter)] [--bleed-down:clamp(160px,24vh,280px)] [--bleed-up:clamp(200px,32vh,360px)] [--bleed-out:clamp(80px,12vh,140px)] max-[1025px]:h-auto max-[1025px]:py-[var(--section-y)] max-[1025px]:[--bleed-out:calc(var(--bleed-up)*0.8)]" data-scene="Interaction">
      <PlasmaShader
        colors={backdrop}
        settings={BACKDROP_SETTINGS}
        cursor
        className="absolute inset-x-0 -z-10 block w-full"
        style={{
          top: "calc(-1 * var(--bleed-out))",
          height: "calc(100% + var(--bleed-out) + var(--bleed-down))",
          maskImage: BLEED_MASK,
          WebkitMaskImage: BLEED_MASK,
        }}
      />

      <div className="space-y-3 text-center">
        {/* Same voice as the statement and clients above: display serif over a quiet grotesk. */}
        <h2 className="text-balance text-[clamp(2.5rem,5vw,6rem)] font-normal leading-[1.02] tracking-[-0.035em] text-white [font-family:var(--font-serif),serif]">
          Elevating interaction through motion
        </h2>
        <p className="text-[clamp(0.9375rem,0.85rem+0.25vw,1.125rem)] tracking-[0.02em] text-white/60 [font-family:var(--font-label),sans-serif]">
          Hover the list to see the effect
        </p>
      </div>

      <InteractiveListPreview bgColor="transparent" />
    </section>
  );
}
