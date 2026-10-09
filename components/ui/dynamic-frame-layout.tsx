"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { SCROLL_SETTLE_EVENT } from "@/components/ScrollState"

interface Frame {
  id: number
  video: string
  poster?: string
  defaultPos: { x: number; y: number; w: number; h: number }
  corner: string
  edgeHorizontal: string
  edgeVertical: string
  mediaSize: number
  borderThickness: number
  borderSize: number
  isHovered: boolean
}

interface FrameComponentProps {
  video: string
  poster?: string
  width: number | string
  height: number | string
  className?: string
  corner: string
  edgeHorizontal: string
  edgeVertical: string
  mediaSize: number
  borderThickness: number
  borderSize: number
  showFrame: boolean
  isHovered: boolean
  /** Touch screens have no hover: play while on screen instead. */
  playInView?: boolean
}

function FrameComponent({
  video,
  poster,
  width,
  height,
  className = "",
  corner,
  edgeHorizontal,
  edgeVertical,
  mediaSize,
  borderThickness,
  borderSize,
  showFrame,
  isHovered,
  playInView = false,
}: FrameComponentProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!playInView || !video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.4 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [playInView])

  useEffect(() => {
    if (playInView) return
    if (isHovered) {
      videoRef.current?.play()
    } else {
      videoRef.current?.pause()
    }
  }, [isHovered, playInView])

  return (
    <div
      className={`relative ${className}`}
      style={{
        width,
        height,
        transition: "width 0.3s ease-in-out, height 0.3s ease-in-out",
      }}
    >
      <div className="relative w-full h-full overflow-hidden">
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            zIndex: 1,
            transition: "all 0.3s ease-in-out",
            padding: showFrame ? `${borderThickness}px` : "0",
            width: showFrame ? `${borderSize}%` : "100%",
            height: showFrame ? `${borderSize}%` : "100%",
            left: showFrame ? `${(100 - borderSize) / 2}%` : "0",
            top: showFrame ? `${(100 - borderSize) / 2}%` : "0",
          }}
        >
          <div
            className="w-full h-full overflow-hidden"
            style={{
              transform: `scale(${mediaSize})`,
              transformOrigin: "center",
              transition: "transform 0.3s ease-in-out",
            }}
          >
            <video
              className="w-full h-full object-cover"
              src={video}
              poster={poster}
              preload="none"
              loop
              muted
              playsInline
              ref={videoRef}
            />
          </div>
        </div>

        {showFrame && (
          <div className="absolute inset-0" style={{ zIndex: 2 }}>
            <div
              className="absolute top-0 left-0 w-16 h-16 bg-contain bg-no-repeat"
              style={{ backgroundImage: `url(${corner})` }}
            />
            <div
              className="absolute top-0 right-0 w-16 h-16 bg-contain bg-no-repeat"
              style={{ backgroundImage: `url(${corner})`, transform: "scaleX(-1)" }}
            />
            <div
              className="absolute bottom-0 left-0 w-16 h-16 bg-contain bg-no-repeat"
              style={{ backgroundImage: `url(${corner})`, transform: "scaleY(-1)" }}
            />
            <div
              className="absolute bottom-0 right-0 w-16 h-16 bg-contain bg-no-repeat"
              style={{ backgroundImage: `url(${corner})`, transform: "scale(-1, -1)" }}
            />

            <div
              className="absolute top-0 left-16 right-16 h-16"
              style={{
                backgroundImage: `url(${edgeHorizontal})`,
                backgroundSize: "auto 64px",
                backgroundRepeat: "repeat-x",
              }}
            />
            <div
              className="absolute bottom-0 left-16 right-16 h-16"
              style={{
                backgroundImage: `url(${edgeHorizontal})`,
                backgroundSize: "auto 64px",
                backgroundRepeat: "repeat-x",
                transform: "rotate(180deg)",
              }}
            />
            <div
              className="absolute left-0 top-16 bottom-16 w-16"
              style={{
                backgroundImage: `url(${edgeVertical})`,
                backgroundSize: "64px auto",
                backgroundRepeat: "repeat-y",
              }}
            />
            <div
              className="absolute right-0 top-16 bottom-16 w-16"
              style={{
                backgroundImage: `url(${edgeVertical})`,
                backgroundSize: "64px auto",
                backgroundRepeat: "repeat-y",
                transform: "scaleX(-1)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [query])

  return matches
}

interface DynamicFrameLayoutProps {
  frames: Frame[]
  className?: string
  showFrames?: boolean
  hoverSize?: number
  gapSize?: number
}

export function DynamicFrameLayout({
  frames: initialFrames,
  className,
  showFrames = false,
  hoverSize = 6,
  gapSize = 4
}: DynamicFrameLayoutProps) {
  const [frames] = useState<Frame[]>(initialFrames)
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null)
  const isTouch = useMediaQuery("(hover: none), (pointer: coarse)")
  const isNarrow = useMediaQuery("(max-width: 767px)")

  /*
   * Hover follows the pointer's position rather than mouseenter events, which get lost when
   * the page scrolls under a still pointer. While the page is scrolling the grid holds still
   * (resizing nine videos mid-scroll stutters); the moment scrolling settles, or the mouse
   * moves, the cell under the pointer takes over.
   */
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  const gridOnScreen = useRef(false)

  const pickUnderPointer = () => {
    if (document.documentElement.dataset.scrolling !== undefined) return
    // Off screen nothing can be under the pointer; skip the layout reads (this runs on every page-wide move).
    if (!gridOnScreen.current) {
      setHovered((prev) => (prev === null ? prev : null))
      return
    }
    const p = pointerRef.current
    const grid = gridRef.current
    if (!grid) return
    const g = grid.getBoundingClientRect()
    const inside = p && p.x >= g.left && p.x <= g.right && p.y >= g.top && p.y <= g.bottom
    let next: { row: number; col: number } | null = null
    if (inside && p) {
      frames.forEach((frame, i) => {
        const r = cellRefs.current[i]?.getBoundingClientRect()
        if (r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
          next = { row: Math.floor(frame.defaultPos.y / 4), col: Math.floor(frame.defaultPos.x / 4) }
        }
      })
    }
    setHovered((prev) => {
      const a = prev as { row: number; col: number } | null
      const b = next as { row: number; col: number } | null
      return a?.row === b?.row && a?.col === b?.col ? prev : b
    })
  }

  useEffect(() => {
    if (isTouch || isNarrow) return
    // The pointer is tracked page-wide so a still pointer is known even after content moves.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      pointerRef.current = { x: e.clientX, y: e.clientY }
      pickUnderPointer()
    }
    const onSettle = () => pickUnderPointer()
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        pointerRef.current = null
        pickUnderPointer()
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      gridOnScreen.current = entry.isIntersecting
    })
    if (gridRef.current) io.observe(gridRef.current)
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener(SCROLL_SETTLE_EVENT, onSettle)
    document.addEventListener("mouseout", onOut)
    return () => {
      io.disconnect()
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener(SCROLL_SETTLE_EVENT, onSettle)
      document.removeEventListener("mouseout", onOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouch, isNarrow])

  const getRowSizes = () => {
    if (hovered === null) return "4fr 4fr 4fr"
    const { row } = hovered
    const nonHoveredSize = (12 - hoverSize) / 2
    return [0, 1, 2].map((r) => (r === row ? `${hoverSize}fr` : `${nonHoveredSize}fr`)).join(" ")
  }

  const getColSizes = () => {
    if (hovered === null) return "4fr 4fr 4fr"
    const { col } = hovered
    const nonHoveredSize = (12 - hoverSize) / 2
    return [0, 1, 2].map((c) => (c === col ? `${hoverSize}fr` : `${nonHoveredSize}fr`)).join(" ")
  }

  const getTransformOrigin = (x: number, y: number) => {
    const vertical = y === 0 ? "top" : y === 4 ? "center" : "bottom"
    const horizontal = x === 0 ? "left" : x === 4 ? "center" : "right"
    return `${vertical} ${horizontal}`
  }

  // Phones: one full-width column so the videos' centered titles aren't cropped; no hover resizing.
  if (isNarrow) {
    return (
      <div
        className={`relative grid w-full grid-cols-1 ${className}`}
        style={{ gap: `${gapSize}px` }}
      >
        {frames.map((frame) => (
          <div key={frame.id} className="relative aspect-video">
            <FrameComponent
              video={frame.video}
              poster={frame.poster}
              width="100%"
              height="100%"
              className="absolute inset-0"
              corner={frame.corner}
              edgeHorizontal={frame.edgeHorizontal}
              edgeVertical={frame.edgeVertical}
              mediaSize={frame.mediaSize}
              borderThickness={frame.borderThickness}
              borderSize={frame.borderSize}
              showFrame={showFrames}
              isHovered={false}
              playInView
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={gridRef}
      className={`relative w-full h-full ${className}`}
      style={{
        display: "grid",
        gridTemplateRows: getRowSizes(),
        gridTemplateColumns: getColSizes(),
        gap: `${gapSize}px`,
        transition: "grid-template-rows 0.4s ease, grid-template-columns 0.4s ease",
      }}
    >
      {frames.map((frame, index) => {
        const row = Math.floor(frame.defaultPos.y / 4)
        const col = Math.floor(frame.defaultPos.x / 4)
        const transformOrigin = getTransformOrigin(frame.defaultPos.x, frame.defaultPos.y)

        return (
          <motion.div
            key={frame.id}
            className="relative"
            style={{
              transformOrigin,
              transition: "transform 0.4s ease",
            }}
            ref={(el: HTMLDivElement | null) => {
              cellRefs.current[index] = el
            }}
          >
            <FrameComponent
              video={frame.video}
              poster={frame.poster}
              width="100%"
              height="100%"
              className="absolute inset-0"
              corner={frame.corner}
              edgeHorizontal={frame.edgeHorizontal}
              edgeVertical={frame.edgeVertical}
              mediaSize={frame.mediaSize}
              borderThickness={frame.borderThickness}
              borderSize={frame.borderSize}
              showFrame={showFrames}
              isHovered={hovered?.row === row && hovered?.col === col}
              playInView={isTouch}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
