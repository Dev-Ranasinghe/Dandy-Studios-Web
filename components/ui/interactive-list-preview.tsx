// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import gsap from "gsap";

export interface InteractiveListItem {
  client: string;
  platform?: string;
  services: string;
  img: string;
}

export interface InteractiveListPreviewProps {
  items?: InteractiveListItem[];
  /** Scale multiplier for the hover preview image. */
  imageSize?: number;
  /** Preview image reveal / hide duration (seconds). */
  duration?: number;
  /** Highlight bar + row text transition smoothing (seconds). */
  smoothness?: number;
  /** Pointer-follow smoothing; higher tracks faster. */
  lerp?: number;
  /** Background color of the list surface. */
  bgColor?: string;
  className?: string;
}

const DEFAULT_IMAGE_Z_INDEX = 10;
const DEFAULT_IMAGE_SIZE = 1;
const DEFAULT_DURATION = 0.6;
const DEFAULT_SMOOTHNESS = 0.35;
const DEFAULT_LERP = 0.18;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=720&h=840&q=80`;

const DEFAULT_ITEMS: InteractiveListItem[] = [
  { client: "AURORA UI", platform: "NEXT.JS", services: "Motion Design, GSAP, Page Transitions, UI Systems", img: unsplash("1618005182384-a83a8bd57fbe") },
  { client: "NEON FLOW", platform: "REACT", services: "Interactive UI, Scroll Animations, Effects Library", img: unsplash("1557672172-298e090bd0f1") },
  { client: "GLASSMORPH", platform: "NEXT.JS", services: "Glass UI, Components, Motion Architecture", img: unsplash("1550684848-fac1c5b4e853") },
  { client: "VOID SYSTEM", platform: "CUSTOM WEBGL", services: "Shaders, Creative Development, Visual Effects", img: unsplash("1541701494587-cb58502866ab") },
  { client: "HYPER SCROLL", platform: "FRAMER MOTION", services: "Scroll Storytelling, Motion Systems, Interactions", img: unsplash("1558591710-4b4a1ae0f04d") },
  { client: "KINETIC LAB", platform: "THREE.JS", services: "3D Interfaces, Motion UI, WebGL Experiences", img: unsplash("1579546929518-9e396f3cc809") },
  { client: "PIXEL GRID", platform: "TAILWIND CSS", services: "Design Systems, UI Engineering, Responsive Layouts", img: unsplash("1604079628040-94301bb21b91") },
  { client: "MOTION CORE", platform: "HEADLESS CMS", services: "Reusable Components, Motion Engine, Performance", img: unsplash("1614850523459-c2f4c699c52e") },
  { client: "INTERFACE X", platform: "NEXT.JS", services: "Immersive UI, Creative Coding, Transitions, Effects", img: unsplash("1620641788421-7a1c342ea42e") },
  { client: "HYPERIUX", platform: "UI LIBRARY", services: "Animations, Interactive Components, Futuristic Experiences", img: unsplash("1635776062127-d379bfcba9f8") },
];

const BASE_IMAGE_WIDTH_REM = 19.5;
const BASE_IMAGE_HEIGHT_REM = 22.5;
const IMAGE_OFFSET_MULTIPLIER = 20;
const ACTIVE_ROW_TEXT_COLOR = "#000000";
const INACTIVE_ROW_TEXT_COLOR = "#ffffff";
const IMAGE_HIDDEN_CLIP_PATH = "inset(50%)";
const IMAGE_VISIBLE_CLIP_PATH = "inset(0%)";
const IMAGE_VISIBILITY_HIDDEN = "hidden";
const IMAGE_VISIBILITY_VISIBLE = "visible";

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

/**
 * @typedef {Object} InteractiveListPreviewCompProps
 * @property {InteractiveListItem[]} items
 */

/** @param {InteractiveListPreviewCompProps} props */
export default function InteractiveListPreview({
  items = DEFAULT_ITEMS,
  imageSize = DEFAULT_IMAGE_SIZE,
  duration = DEFAULT_DURATION,
  smoothness = DEFAULT_SMOOTHNESS,
  lerp = DEFAULT_LERP,
  bgColor = "#171717",
  className = "",
}: InteractiveListPreviewProps) {
  const imageRefs = useRef<any[]>([]);
  const imageContainerRef = useRef<any>(null);
  const tableRef = useRef<any>(null);
  const highlightRef = useRef<any>(null);
  const rowRefs = useRef<Record<number, any>>({});
  const pendingLeaveRef = useRef<Record<number, boolean>>({});
  const tweenGenerationRef = useRef<Record<number, number>>({});
  const activeIndexRef = useRef<number | null>(null);
  const zIndexRef = useRef(DEFAULT_IMAGE_Z_INDEX);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const reduceMotionRef = useRef(
    typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false)
  );
  const safeImageSize = clampNumber(imageSize, 0.5, 2, DEFAULT_IMAGE_SIZE);
  const safeDuration = clampNumber(duration, 0.1, 2, DEFAULT_DURATION);
  const safeSmoothness = clampNumber(smoothness, 0.05, 1.5, DEFAULT_SMOOTHNESS);
  const safeLerp = clampNumber(lerp, 0.02, 1, DEFAULT_LERP);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const onChange = (event: MediaQueryListEvent) => {
      reduceMotionRef.current = event.matches;
      if (event.matches && imageContainerRef.current) {
        gsap.killTweensOf(imageContainerRef.current);
        gsap.set(imageContainerRef.current, { x: 0, y: 0 });
        pointerTargetRef.current = { x: 0, y: 0 };
        pointerCurrentRef.current = { x: 0, y: 0 };
      }
    };

    reduceMotionRef.current = mq.matches;
    if (mq.matches && imageContainerRef.current) {
      gsap.set(imageContainerRef.current, { x: 0, y: 0 });
      pointerTargetRef.current = { x: 0, y: 0 };
      pointerCurrentRef.current = { x: 0, y: 0 };
    }
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    // Touch screens and anything narrower than a laptop get the stacked card layout.
    const mq = window.matchMedia("(pointer: coarse), (max-width: 1024px)");
    const update = () => setIsCoarsePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Follow loop runs only while the preview is still catching up to the pointer;
  // it used to tick every frame forever, even off screen.
  const followFrameRef = useRef(0);
  const startFollowRef = useRef<() => void>(() => {});

  useEffect(() => {
    const tick = () => {
      followFrameRef.current = 0;
      const imageContainer = imageContainerRef.current;
      if (!imageContainer || reduceMotionRef.current) return;

      const current = pointerCurrentRef.current;
      const target = pointerTargetRef.current;
      current.x += (target.x - current.x) * safeLerp;
      current.y += (target.y - current.y) * safeLerp;
      gsap.set(imageContainer, { x: current.x, y: current.y });

      if (Math.abs(target.x - current.x) > 0.1 || Math.abs(target.y - current.y) > 0.1) {
        followFrameRef.current = requestAnimationFrame(tick);
      }
    };

    startFollowRef.current = () => {
      if (!followFrameRef.current) followFrameRef.current = requestAnimationFrame(tick);
    };

    return () => {
      cancelAnimationFrame(followFrameRef.current);
      followFrameRef.current = 0;
    };
  }, [safeLerp]);

  useEffect(() => {
    imageRefs.current.forEach((imageElement: any) => {
      if (!imageElement) return;

      if (reduceMotionRef.current) {
        // Reduced-motion: opacity only — keep full clip, start hidden.
        gsap.set(imageElement, {
          clipPath: IMAGE_VISIBLE_CLIP_PATH,
          opacity: 0,
          visibility: IMAGE_VISIBILITY_HIDDEN,
        });
      } else {
        gsap.set(imageElement, {
          clipPath: IMAGE_HIDDEN_CLIP_PATH,
          visibility: IMAGE_VISIBILITY_HIDDEN,
        });
      }
    });

    if (!highlightRef.current) return;

    gsap.set(highlightRef.current, {
      opacity: 0,
      y: 0,
      height: 0,
    });
  }, []);

  /** @param {number} index */
  const getNextTweenGeneration = (index: number) => {
    tweenGenerationRef.current[index] =
      (tweenGenerationRef.current[index] || 0) + 1;

    return tweenGenerationRef.current[index];
  };

  /**
   * @param {number} index
   * @param {HTMLDivElement|null} element
   */
  const setImageRef = (index: number, element: HTMLDivElement | null) => {
    imageRefs.current[index] = element;
  };

  /**
   * @param {number} index
   * @param {string} color
   */
  const setRowTextColor = (index: number, color: string) => {
    const rowElement = rowRefs.current[index];

    if (!rowElement) return;

    gsap.to(rowElement.querySelectorAll("td"), {
      color,
      duration: safeSmoothness,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  /** @param {HTMLTableRowElement|null} rowElement */
  const moveHighlightToRow = (rowElement: HTMLTableRowElement | null) => {
    const tableElement = tableRef.current;
    const highlightElement = highlightRef.current;

    if (!tableElement || !highlightElement || !rowElement) return;

    const tableBounds = tableElement.getBoundingClientRect();
    const rowBounds = rowElement.getBoundingClientRect();

    gsap.to(highlightElement, {
      y: rowBounds.top - tableBounds.top,
      height: rowBounds.height,
      opacity: 1,
      duration: safeSmoothness,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  /** @param {number} index */
  const animateImageOut = (index: number) => {
    const imageElement = imageRefs.current[index];

    if (!imageElement) return;

    const tweenGeneration = getNextTweenGeneration(index);
    const reduceMotion = reduceMotionRef.current;

    gsap.killTweensOf(imageElement);

    gsap.to(imageElement, {
      ...(reduceMotion
        ? { opacity: 0 }
        : { clipPath: IMAGE_HIDDEN_CLIP_PATH, opacity: 0 }),
      duration: reduceMotion ? Math.min(safeSmoothness, 0.35) : safeDuration,
      ease: reduceMotion ? "power2.out" : "power3.inOut",
      onComplete: () => {
        if (tweenGenerationRef.current[index] !== tweenGeneration) return;

        gsap.set(imageElement, {
          visibility: IMAGE_VISIBILITY_HIDDEN,
        });
      },
    });
  };

  /**
   * @param {HTMLTableRowElement} rowElement
   * @param {number} index
   */
  const onRowEnter = (rowElement: HTMLTableRowElement, index: number) => {
    const imageElement = imageRefs.current[index];

    if (!imageElement) return;

    const reduceMotion = reduceMotionRef.current;
    const previousIndex = activeIndexRef.current;

    pendingLeaveRef.current[index] = false;
    rowRefs.current[index] = rowElement;

    // Reduced-motion: only one image at a time — fade the previous out first.
    if (reduceMotion && previousIndex !== null && previousIndex !== index) {
      pendingLeaveRef.current[previousIndex] = false;
      animateImageOut(previousIndex);
    }

    zIndexRef.current += 1;

    const tweenGeneration = getNextTweenGeneration(index);

    gsap.killTweensOf(imageElement);

    if (reduceMotion) {
      gsap.set(imageElement, {
        zIndex: zIndexRef.current,
        visibility: IMAGE_VISIBILITY_VISIBLE,
        clipPath: IMAGE_VISIBLE_CLIP_PATH,
        opacity: 0,
      });

      gsap.to(imageElement, {
        opacity: 1,
        duration: Math.min(safeSmoothness, 0.35),
        ease: "power2.out",
        onComplete: () => {
          if (tweenGenerationRef.current[index] !== tweenGeneration) return;
          if (!pendingLeaveRef.current[index]) return;

          pendingLeaveRef.current[index] = false;
          animateImageOut(index);
        },
      });
    } else {
      gsap.set(imageElement, {
        zIndex: zIndexRef.current,
        visibility: IMAGE_VISIBILITY_VISIBLE,
        clipPath: IMAGE_HIDDEN_CLIP_PATH,
        opacity: 1,
      });

      gsap.to(imageElement, {
        clipPath: IMAGE_VISIBLE_CLIP_PATH,
        opacity: 1,
        duration: safeDuration,
        ease: "power2.inOut",
        onComplete: () => {
          if (tweenGenerationRef.current[index] !== tweenGeneration) return;
          if (!pendingLeaveRef.current[index]) return;

          pendingLeaveRef.current[index] = false;
          animateImageOut(index);
        },
      });
    }

    if (previousIndex !== null && previousIndex !== index) {
      setRowTextColor(previousIndex, INACTIVE_ROW_TEXT_COLOR);
    }

    activeIndexRef.current = index;

    setRowTextColor(index, ACTIVE_ROW_TEXT_COLOR);
    moveHighlightToRow(rowElement);
  };

  /** @param {number} index */
  const onRowLeave = (index: number) => {
    const imageElement = imageRefs.current[index];

    if (!imageElement) return;

    if (gsap.isTweening(imageElement)) {
      pendingLeaveRef.current[index] = true;
      return;
    }

    animateImageOut(index);
  };

  const onTableLeave = () => {
    if (activeIndexRef.current !== null) {
      setRowTextColor(activeIndexRef.current, INACTIVE_ROW_TEXT_COLOR);
      activeIndexRef.current = null;
    }

    if (!highlightRef.current) return;

    gsap.to(highlightRef.current, {
      opacity: 0,
      duration: safeSmoothness,
      ease: "power2.out",
      overwrite: "auto",
    });

    pointerTargetRef.current = { x: 0, y: 0 };
    startFollowRef.current();
  };

  /** @param {import('react').MouseEvent<HTMLDivElement>} event */
  const onMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    // A row can miss its mouseenter: the pointer was already resting on it when the page
    // loaded, or content scrolled under a still pointer. Any movement recovers it.
    if (activeIndexRef.current === null) {
      const row = (event.target as Element).closest<HTMLTableRowElement>("tr[data-index]");
      if (row) onRowEnter(row, Number(row.dataset.index));
    }

    // Reduced-motion: no cursor parallax on the preview images.
    if (reduceMotionRef.current) return;
    if (!imageContainerRef.current) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    pointerTargetRef.current = {
      x: x * IMAGE_OFFSET_MULTIPLIER,
      y: y * IMAGE_OFFSET_MULTIPLIER,
    };
    startFollowRef.current();
  };

  return (
    <>
      {!isCoarsePointer && (
      <div
        style={{ backgroundColor: bgColor }}
        className={`relative w-full overflow-hidden [font-family:var(--font-label),sans-serif] text-white ${className}`}
        onMouseMove={onMouseMove}
      >
        <div
          ref={highlightRef}
          className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-white"
        />

        <div
          ref={imageContainerRef}
          className="pointer-events-none absolute inset-0 z-20"
          style={{ mixBlendMode: "difference" }}
        >
          {items.map((item: any, index: number) => (
            <div
              key={`${item.client}-${index}`}
              ref={(element) => setImageRef(index, element)}
              className="invisible absolute left-[35%] top-1/2 h-90 w-78 -translate-y-1/2"
              style={{
                width: `${BASE_IMAGE_WIDTH_REM * safeImageSize}rem`,
                height: `${BASE_IMAGE_HEIGHT_REM * safeImageSize}rem`,
                willChange: "clip-path, opacity",
                zIndex: DEFAULT_IMAGE_Z_INDEX,
              }}
            >
              <img src={item.img} alt="hover-item-image" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ))}
        </div>

        <div
          ref={tableRef}
          className="relative w-full"
          onMouseLeave={onTableLeave}
        >
          <table className="relative z-30 w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "40%" }} />
            </colgroup>

            <tbody>
              {items.map((item: any, index: number) => (
                <tr
                  key={`${item.client}-${index}`}
                  data-index={index}
                  onMouseEnter={(event) =>
                    onRowEnter(event.currentTarget, index)
                  }
                  onMouseLeave={() => onRowLeave(index)}
                >
                  <td className="whitespace-nowrap px-6 py-3 text-xs uppercase tracking-widest">
                    {item.client}
                  </td>

                  <td className="whitespace-nowrap px-6 py-3 text-xs uppercase tracking-widest">
                    {item.platform}
                  </td>

                  <td className="whitespace-nowrap px-6 py-3 text-center text-xs uppercase tracking-widest">

                  </td>

                  <td className="whitespace-nowrap px-6 py-3 text-xs uppercase tracking-widest">
                    {item.services}
                  </td>
                </tr>
              ))}

              <tr>
                <td colSpan={4} className="p-0" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      {isCoarsePointer && (
      <div style={{ backgroundColor: bgColor }} className={`w-full [font-family:var(--font-label),sans-serif] text-white ${className}`}>
        {items.map((item: any, index: number) => (
          <div key={`${item.client}-${index}`} className="flex border-b border-white/10">
            <div className="flex w-1/2 flex-col justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <p className="font-bold uppercase tracking-widest max-md:text-sm max-[1025px]:text-xl">
                  {item.client}
                </p>

                {item.platform && (
                  <p className="uppercase tracking-widest text-white/60 max-md:text-xs max-[1025px]:text-lg">
                    {item.platform}
                  </p>
                )}

                <p className="leading-relaxed text-white/50 max-md:text-xs max-[1025px]:text-base">
                  {item.services}
                </p>
              </div>


            </div>

            <div className="relative aspect-3/4 h-full w-1/2 max-[1025px]:h-[30vh]">
              <img
                src={item.img}
                alt={item.client}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>
      )}
    </>
  );
}
