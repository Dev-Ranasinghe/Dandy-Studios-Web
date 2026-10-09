"use client"

import { DynamicFrameLayout } from "@/components/ui/dynamic-frame-layout"

// Videos: 720p local transcodes of the original 1080p60 CDN files (133 MB down to ~4 MB),
// each with its first frame as a poster, so nothing streams in until a cell plays.

// Frame decoration fields are unused while showFrames is off; empty defaults satisfy the Frame type.
const frameDefaults = {
  corner: "",
  edgeHorizontal: "",
  edgeVertical: "",
  borderThickness: 0,
  borderSize: 80,
}

const demoFrames = [
  {
    id: 1,
    video: "/video/grid/01.mp4",
    poster: "/video/grid/01.jpg",
    defaultPos: { x: 0, y: 0, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 2,
    video: "/video/grid/02.mp4",
    poster: "/video/grid/02.jpg",
    defaultPos: { x: 4, y: 0, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 3,
    video: "/video/grid/03.mp4",
    poster: "/video/grid/03.jpg",
    defaultPos: { x: 8, y: 0, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 4,
    video: "/video/grid/04.mp4",
    poster: "/video/grid/04.jpg",
    defaultPos: { x: 0, y: 4, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 5,
    video: "/video/grid/05.mp4",
    poster: "/video/grid/05.jpg",
    defaultPos: { x: 4, y: 4, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 6,
    video: "/video/grid/06.mp4",
    poster: "/video/grid/06.jpg",
    defaultPos: { x: 8, y: 4, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 7,
    video: "/video/grid/07.mp4",
    poster: "/video/grid/07.jpg",
    defaultPos: { x: 0, y: 8, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 8,
    video: "/video/grid/08.mp4",
    poster: "/video/grid/08.jpg",
    defaultPos: { x: 4, y: 8, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 9,
    video: "/video/grid/09.mp4",
    poster: "/video/grid/09.jpg",
    defaultPos: { x: 8, y: 8, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
].map((frame) => ({ ...frameDefaults, ...frame }))

export default function FrameGridSection() {
  return (
    <section className="h-screen w-full bg-zinc-900 max-md:h-auto" data-scene="Showreel">
      <DynamicFrameLayout
        frames={demoFrames}
        className="w-full h-full"
        hoverSize={6}
        gapSize={4}
      />
    </section>
  )
}
