// Built using Hyperiux Vault: https://vault.hyperiux.com
// Local changes from the original: items can carry a `label` (shown on the card) and an `href`
// (the card becomes a link); `initialMode` picks the starting layout; `showModes` hides the mode
// buttons; the rotation loop pauses while the slider is off screen; the embedded base64 demo
// images are gone (pass `items`); `className` sizes the root instead of a fixed h-screen;
// `children` render inside the ring's depth order, between its far and near cards.
"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => (typeof window === "undefined" ? false : window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false),
    () => false,
  );
}

gsap.registerPlugin(Flip);

export type OrbitFlipSliderMode = "flat" | "tilt" | "ring" | "gallery";

export interface OrbitFlipSliderItem {
  id?: string | number;
  image: string;
  alt?: string;
  label?: string;
  href?: string;
}

interface OrbitFlipSliderCompProps {
  items: OrbitFlipSliderItem[];
  /** Content set at the ring's centre depth: far cards pass behind it, near cards in front. */
  children?: React.ReactNode;
  initialMode?: OrbitFlipSliderMode;
  showModes?: boolean;
  className?: string;
  backgroundColor?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageGap?: number;
  rounded?: string;
  enableHoverMovement?: boolean;
  hoverMoveY?: number;
  perspectiveRotateValue?: number;
  perspectiveRotateDirection?: "left" | "right";
  rotate?: boolean;
  rotateSpeed?: number;
  stopRotationOnHover?: boolean;
  flatRadiusX?: number;
  flatRadiusY?: number;
  flatScale?: number;
  ringRotateX?: number;
  ringRotateY?: number;
  ringRotateZ?: number;
  ringRadiusX?: number;
  ringRadiusY?: number;
  ringScale?: number;
  tiltRotateX?: number;
  tiltRotateY?: number;
  tiltRotateZ?: number;
  tiltRadiusX?: number;
  tiltRadiusY?: number;
  tiltScale?: number;
  tiltMoveY?: number;
  galleryRotateX?: number;
  galleryRotateY?: number;
  galleryRotateZ?: number;
  galleryRadiusX?: number;
  galleryRadiusY?: number;
  galleryScale?: number;
}

interface CardBox {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface AxisTransform {
  x: number;
  y: number;
  z: number;
  radiusX: number;
  radiusY: number;
  scale: number;
  moveY: number;
}

const MODES: { key: OrbitFlipSliderMode; label: string }[] = [
  { key: "flat", label: "Flat" },
  { key: "tilt", label: "Tilt" },
  { key: "ring", label: "Ring" },
  { key: "gallery", label: "Gallery" },
];

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const MOBILE_BREAKPOINT = 768;
const MOBILE_FLAT_RADIUS_X_SCALE = 0.55;
const MOBILE_TILT_RADIUS_X_SCALE = 0.6;
const MOBILE_TILT_RADIUS_Y_SCALE = 0.8;
const MOBILE_RING_SCALE = 0.6;
const MOBILE_GALLERY_SCALE = 0.6;

interface CoverflowParams {
  radius: number;
  tiltDeg: number;
  camDistFactor: number;
  offsetDeg: number;
  anchorY: number;
  positionScaleStrength?: number;
  sizeScaleStrength?: number;
}

const getBaseOrbitRadius = (count: number, cardWidth: number, cardHeight: number, imageGap: number) => {
  const baseSpan = Math.max(cardWidth, cardHeight) + imageGap;
  return Math.max(((count * baseSpan) / (2 * Math.PI)) * 0.62, baseSpan * 0.9);
};

// Every card sits on a ring, billboarded (always facing forward); depth only drives size and z-order.
const buildCoverflowLayout = (
  count: number,
  containerW: number,
  containerH: number,
  sizes: { w: number; h: number }[],
  params: CoverflowParams,
): CardBox[] => {
  const cx = containerW / 2;
  const camDist = params.radius * params.camDistFactor;
  const tilt = degToRad(params.tiltDeg);
  const positionScaleStrength = params.positionScaleStrength ?? 1;
  const sizeScaleStrength = params.sizeScaleStrength ?? 0.42;

  return sizes.map((size, i) => {
    const theta = degToRad(params.offsetDeg + (i / count) * 360);
    const px = params.radius * Math.sin(theta);
    const pz0 = -params.radius * Math.cos(theta);
    const py = -pz0 * Math.sin(tilt);
    const pz = pz0 * Math.cos(tilt);
    const scale = Math.max(camDist / (camDist + pz), 0.05);
    const positionScale = 1 + (scale - 1) * positionScaleStrength;
    const sizeScale = 1 + (scale - 1) * sizeScaleStrength;
    return {
      x: cx + px * positionScale,
      y: containerH * params.anchorY + py * positionScale,
      width: size.w * sizeScale,
      height: size.h * sizeScale,
      zIndex: Math.round(scale * 1000) + 1,
    };
  });
};

const applyZRotation = (boxes: CardBox[], cx: number, cy: number, zDeg: number): CardBox[] => {
  if (!zDeg) return boxes;
  const cos = Math.cos(degToRad(zDeg));
  const sin = Math.sin(degToRad(zDeg));
  return boxes.map((box) => {
    const dx = box.x - cx;
    const dy = box.y - cy;
    return { ...box, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
};

const applyRadiusScale = (boxes: CardBox[], cx: number, cy: number, baseRadius: number, radiusX: number, radiusY: number) => {
  const sx = radiusX / baseRadius;
  const sy = radiusY / baseRadius;
  if (sx === 1 && sy === 1) return boxes;
  return boxes.map((box) => ({ ...box, x: cx + (box.x - cx) * sx, y: cy + (box.y - cy) * sy }));
};

const applyUniformScale = (boxes: CardBox[], cx: number, cy: number, scale: number) => {
  if (scale === 1) return boxes;
  return boxes.map((box) => ({
    ...box,
    x: cx + (box.x - cx) * scale,
    y: cy + (box.y - cy) * scale,
    width: box.width * scale,
    height: box.height * scale,
  }));
};

const applyTransform = (boxes: CardBox[], cx: number, cy: number, baseRadius: number, t: AxisTransform) => {
  const radiusScaled = applyRadiusScale(boxes, cx, cy, baseRadius, baseRadius * t.radiusX, baseRadius * t.radiusY);
  return applyZRotation(applyUniformScale(radiusScaled, cx, cy, t.scale), cx, cy, t.z);
};

interface FlatTransform {
  radiusX: number;
  radiusY: number;
  scale: number;
}

interface ModeTransforms {
  flat: FlatTransform;
  tilt: AxisTransform;
  ring: AxisTransform;
  gallery: AxisTransform;
}

const buildLayout = (
  mode: OrbitFlipSliderMode,
  count: number,
  containerW: number,
  containerH: number,
  sizes: { w: number; h: number }[],
  transforms: ModeTransforms,
  imageGap: number,
  rotationOffsetDeg = 0,
): CardBox[] => {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const baseRadius = getBaseOrbitRadius(count, sizes[0]?.w ?? 140, sizes[0]?.h ?? 200, imageGap);

  if (mode === "flat") {
    const f = transforms.flat;
    const rx = baseRadius * f.radiusX;
    const ry = baseRadius * f.radiusY;
    const boxes = sizes.map((size, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + degToRad(rotationOffsetDeg);
      return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), width: size.w, height: size.h, zIndex: i + 1 };
    });
    return applyUniformScale(boxes, cx, cy, f.scale);
  }

  const t = transforms[mode];
  const radius = mode === "gallery" ? baseRadius * 1.55 : baseRadius * 1.12;
  const boxes = buildCoverflowLayout(count, containerW, containerH, sizes, {
    radius,
    tiltDeg: t.x,
    camDistFactor: mode === "gallery" ? 1.55 : 1.75,
    offsetDeg: -90 + t.y + rotationOffsetDeg,
    anchorY: 0.5,
    positionScaleStrength: mode === "gallery" ? 0.28 : 0.45,
    sizeScaleStrength: mode === "gallery" ? 0.16 : 0.42,
  });
  const transformed = applyTransform(boxes, cx, containerH * 0.5, radius, t);
  return t.moveY ? transformed.map((box) => ({ ...box, y: box.y + t.moveY })) : transformed;
};

const OrbitFlipSlider = ({
  items,
  children,
  initialMode = "flat",
  showModes = true,
  className = "h-screen",
  backgroundColor = "transparent",
  imageWidth = 140,
  imageHeight = 200,
  imageGap = 0,
  rounded = "rounded-none",
  enableHoverMovement = true,
  hoverMoveY = -8,
  perspectiveRotateValue = 180,
  perspectiveRotateDirection = "right",
  rotate = true,
  rotateSpeed = 4,
  stopRotationOnHover = true,
  flatRadiusX = 1,
  flatRadiusY = 1,
  flatScale = 1,
  ringRotateX = 31,
  ringRotateY = 56,
  ringRotateZ = -25,
  ringRadiusX = 1.5,
  ringRadiusY = 0.65,
  ringScale = 0.6,
  tiltRotateX = 70,
  tiltRotateY = 0,
  tiltRotateZ = 0,
  tiltRadiusX = 1.2,
  tiltRadiusY = 1,
  tiltScale = 1,
  tiltMoveY = 325,
  galleryRotateX = 10,
  galleryRotateY = 0,
  galleryRotateZ = 0,
  galleryRadiusX = 1,
  galleryRadiusY = 1,
  galleryScale = 1,
}: OrbitFlipSliderCompProps) => {
  const FLIP_DURATION_SECONDS = 0.9;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<OrbitFlipSliderMode>(initialMode);
  const isFlipAnimatingRef = useRef(false);
  const flipResumeTimeoutRef = useRef<number | null>(null);
  const rotationOffsetRef = useRef(0);
  const trackSizeRef = useRef<{ width: number; height: number } | null>(null);
  const hoveredCardCountRef = useRef(0);
  const [activeMode, setActiveMode] = useState<OrbitFlipSliderMode>(initialMode);
  const reducedMotion = usePrefersReducedMotion();

  const sizes = items.map(() => ({ w: imageWidth, h: imageHeight }));
  const transforms: ModeTransforms = {
    flat: { radiusX: flatRadiusX, radiusY: flatRadiusY, scale: flatScale },
    tilt: { x: tiltRotateX, y: tiltRotateY, z: tiltRotateZ, radiusX: tiltRadiusX, radiusY: tiltRadiusY, scale: tiltScale, moveY: tiltMoveY },
    ring: { x: ringRotateX, y: ringRotateY, z: ringRotateZ, radiusX: ringRadiusX, radiusY: ringRadiusY, scale: ringScale, moveY: 0 },
    gallery: { x: galleryRotateX, y: galleryRotateY, z: galleryRotateZ, radiusX: galleryRadiusX, radiusY: galleryRadiusY, scale: galleryScale, moveY: 0 },
  };

  const applyLayout = useCallback(
    (mode: OrbitFlipSliderMode, animate: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      const cards = gsap.utils.toArray<HTMLElement>(".orbit-flip-slider-card", track);
      if (!cards.length) return;

      // Sized from a ResizeObserver: a layout read here, once per orbit frame, forced a synchronous layout every frame.
      if (!trackSizeRef.current) {
        const { width, height } = track.getBoundingClientRect();
        trackSizeRef.current = { width, height };
      }
      const { width, height } = trackSizeRef.current;
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const t: ModeTransforms = isMobile
        ? {
            ...transforms,
            flat: { ...transforms.flat, radiusX: transforms.flat.radiusX * MOBILE_FLAT_RADIUS_X_SCALE },
            tilt: {
              ...transforms.tilt,
              radiusX: transforms.tilt.radiusX * MOBILE_TILT_RADIUS_X_SCALE,
              radiusY: transforms.tilt.radiusY * MOBILE_TILT_RADIUS_Y_SCALE,
            },
            ring: { ...transforms.ring, scale: transforms.ring.scale * MOBILE_RING_SCALE },
            gallery: { ...transforms.gallery, scale: transforms.gallery.scale * MOBILE_GALLERY_SCALE },
          }
        : transforms;
      const layout = buildLayout(mode, cards.length, width, height, sizes, t, imageGap, rotationOffsetRef.current);

      // Each card keeps its base size and takes its depth as a scale, so the turning orbit only moves
      // transforms (composited) instead of resizing sixteen boxes, and re-laying them out, every frame.
      const commit = () => {
        cards.forEach((card, i) => {
          const box = layout[i];
          // Drawn at the nearest card's size (depth scale tops out near 1.11), so the composited
          // layer only ever scales down and never blurs.
          const base = { w: Math.round(sizes[i].w * 1.12), h: Math.round(sizes[i].h * 1.12) };
          if (card.dataset.w !== `${base.w}x${base.h}`) {
            card.dataset.w = `${base.w}x${base.h}`;
            gsap.set(card, { width: base.w, height: base.h, xPercent: -50, yPercent: -50 });
          }
          const z = String(box.zIndex);
          if (card.style.zIndex !== z) card.style.zIndex = z;
          gsap.set(card, { x: box.x, y: box.y, scale: box.width / base.w });
        });
      };

      if (!animate || reducedMotion) {
        commit();
        return;
      }

      const state = Flip.getState(cards);
      commit();
      isFlipAnimatingRef.current = true;
      if (flipResumeTimeoutRef.current !== null) window.clearTimeout(flipResumeTimeoutRef.current);
      flipResumeTimeoutRef.current = window.setTimeout(() => {
        isFlipAnimatingRef.current = false;
        flipResumeTimeoutRef.current = null;
      }, FLIP_DURATION_SECONDS * 1000);
      Flip.from(state, { duration: FLIP_DURATION_SECONDS, ease: "power3.inOut", stagger: 0.015, absolute: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      items.length,
      reducedMotion,
      imageWidth,
      imageHeight,
      imageGap,
      flatRadiusX,
      flatRadiusY,
      flatScale,
      ringRotateX,
      ringRotateY,
      ringRotateZ,
      ringRadiusX,
      ringRadiusY,
      ringScale,
      tiltRotateX,
      tiltRotateY,
      tiltRotateZ,
      tiltRadiusX,
      tiltRadiusY,
      tiltScale,
      tiltMoveY,
      galleryRotateX,
      galleryRotateY,
      galleryRotateZ,
      galleryRadiusX,
      galleryRadiusY,
      galleryScale,
    ],
  );

  useEffect(() => {
    const track = trackRef.current;
    applyLayout(modeRef.current, false);
    const ro = new ResizeObserver(([entry]) => {
      trackSizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      applyLayout(modeRef.current, false);
    });
    if (track) ro.observe(track);
    return () => ro.disconnect();
  }, [applyLayout]);

  const handleModeChange = (mode: OrbitFlipSliderMode) => {
    if (mode === modeRef.current) return;
    modeRef.current = mode;
    setActiveMode(mode);
    applyLayout(mode, true);
  };

  // The orbit: nudges the ring each frame, only while on screen; paused mid-Flip and under the pointer.
  useEffect(() => {
    const root = rootRef.current;
    if (!rotate || reducedMotion || !root) return;
    let rafId = 0;
    let lastTime = performance.now();
    let visible = false;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const paused = isFlipAnimatingRef.current || (stopRotationOnHover && hoveredCardCountRef.current > 0);
      if (!paused) {
        rotationOffsetRef.current += rotateSpeed * dt;
        applyLayout(modeRef.current, false);
      }
      rafId = visible ? requestAnimationFrame(tick) : 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    });
    io.observe(root);
    return () => {
      io.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [rotate, rotateSpeed, stopRotationOnHover, reducedMotion, applyLayout]);

  // Hover pops a card toward the viewer and flips it over, with a bouncy ease.
  const handleCardEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      hoveredCardCountRef.current += 1;
      if (reducedMotion || !enableHoverMovement || window.innerWidth < MOBILE_BREAKPOINT) return;
      const inner = e.currentTarget.querySelector<HTMLElement>(".orbit-flip-slider-card-inner");
      if (!inner) return;
      const rotateY = perspectiveRotateDirection === "left" ? -Math.abs(perspectiveRotateValue) : Math.abs(perspectiveRotateValue);
      gsap.killTweensOf(inner);
      gsap.to(inner, { y: hoverMoveY, rotateY, boxShadow: "0 14px 26px rgba(0,0,0,0.35)", duration: 0.8, ease: "back.out(2.2)" });
    },
    [enableHoverMovement, hoverMoveY, perspectiveRotateDirection, perspectiveRotateValue, reducedMotion],
  );

  const handleCardLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      hoveredCardCountRef.current = Math.max(0, hoveredCardCountRef.current - 1);
      if (reducedMotion || !enableHoverMovement || window.innerWidth < MOBILE_BREAKPOINT) return;
      const inner = e.currentTarget.querySelector<HTMLElement>(".orbit-flip-slider-card-inner");
      if (!inner) return;
      gsap.killTweensOf(inner);
      gsap.to(inner, { y: 0, rotateY: 0, boxShadow: "0 1px 2px rgba(0,0,0,0.2)", duration: 0.7, ease: "back.out(2.2)" });
    },
    [enableHoverMovement, reducedMotion],
  );

  return (
    <div ref={rootRef} className={`relative flex w-full flex-col overflow-hidden ${className}`} style={{ backgroundColor }}>
      <div ref={trackRef} className="relative w-full flex-1 overflow-hidden">
        {children && (
          // Cards take z-index round(depthScale * 1000) + 1; depth scale 1 is the ring's centre.
          <div className="pointer-events-none absolute inset-0 grid place-items-center" style={{ zIndex: 1001 }}>
            {children}
          </div>
        )}
        {items.map((item, i) => {
          const Tag = item.href ? "a" : "div";
          return (
            <Tag
              key={item.id ?? i}
              {...(item.href ? { href: item.href } : {})}
              className="orbit-flip-slider-card absolute left-0 top-0 block"
              onMouseEnter={handleCardEnter}
              onMouseLeave={handleCardLeave}
              style={{ perspective: "500px", willChange: "transform" }}
            >
              <div
                className={`orbit-flip-slider-card-inner relative h-full w-full overflow-hidden bg-neutral-900 ${rounded}`}
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transformStyle: "preserve-3d" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.alt ?? item.label ?? `Selected work ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
                {item.label && (
                  <span className="orbit-flip-slider-label pointer-events-none absolute bottom-[7%] left-[7%] right-[7%] truncate">
                    {item.label}
                  </span>
                )}
              </div>
            </Tag>
          );
        })}
      </div>
      {showModes && (
        <div className="absolute left-6 top-20">
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => handleModeChange(m.key)}
                className={`rounded-full border px-5 py-2 text-sm transition-colors duration-300 ${
                  activeMode === m.key ? "border-black bg-black text-white" : "border-black/15 bg-white/70 text-black/70 hover:bg-black/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrbitFlipSlider;
