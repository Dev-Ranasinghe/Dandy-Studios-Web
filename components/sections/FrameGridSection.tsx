"use client"

import { DynamicFrameLayout } from "@/components/ui/dynamic-frame-layout"

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
    video: "https://cdn.21st.dev/assets/mirror/c7/c72edad406566d06615b8c711782465a1974f0f3b0b439b7347edc3974a9e215.mp4",
    defaultPos: { x: 0, y: 0, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 2,
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/WebGL%20Exported%20(1).mp4",
    defaultPos: { x: 4, y: 0, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 3,
    video: "https://cdn.21st.dev/assets/mirror/dc/dc9c6324746faed48effd0f84ee38fa1398ffc426baada0ee69e04b530e3c7d8.mp4",
    defaultPos: { x: 8, y: 0, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 4,
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Exported%20Web%20Video.mp4",
    defaultPos: { x: 0, y: 4, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 5,
    video: "https://cdn.21st.dev/assets/mirror/26/2656819e535252d98acaac11e3130e52b0bb6d7d7b0d53cac2cdc002b29cd282.mp4",
    defaultPos: { x: 4, y: 4, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 6,
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Animation%20Exported%20(4).mp4",
    defaultPos: { x: 8, y: 4, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 7,
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Illustration%20Exported%20(1).mp4",
    defaultPos: { x: 0, y: 8, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 8,
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Art%20Direction%20Exported.mp4",
    defaultPos: { x: 4, y: 8, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
  {
    id: 9,
    video: "https://cdn.21st.dev/assets/mirror/9a/9a94d5bc6d8a6dd70732a1b4938e233bd201da7761226abab9f2e618814b9c1b.mp4",
    defaultPos: { x: 8, y: 8, w: 4, h: 4 },
    mediaSize: 1,
    isHovered: false,
  },
].map((frame) => ({ ...frameDefaults, ...frame }))

export default function FrameGridSection() {
  return (
    <section className="h-screen w-full bg-zinc-900 max-md:h-auto">
      <DynamicFrameLayout
        frames={demoFrames}
        className="w-full h-full"
        hoverSize={6}
        gapSize={4}
      />
    </section>
  )
}
