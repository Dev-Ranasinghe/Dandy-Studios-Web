"use client";

import { useEffect, useState } from "react";
import { ImageTrail } from "@/components/ui/image-trail";
import { WORK } from "@/components/work";
import { cn } from "@/lib/utils";
import styles from "./WorkHero.module.css";

const TRAIL = WORK.map((piece) => ({ src: piece.poster, alt: "" }));

/** Trail tiles grow with the screen; phones get no trail at all (touch is off). */
function useTileSize() {
  const [size, setSize] = useState(200);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)");
    const mid = window.matchMedia("(min-width: 800px)");
    const update = () => setSize(wide.matches ? 220 : mid.matches ? 170 : 130);
    update();
    wide.addEventListener("change", update);
    mid.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      mid.removeEventListener("change", update);
    };
  }, []);
  return size;
}

/**
 * The work page's opening: one statement, centred on bone, and a trail of the work itself
 * that follows the cursor across the whole first screen.
 */
export default function WorkHero() {
  const size = useTileSize();

  return (
    <section className={styles.hero} aria-labelledby="work-heading">
      <ImageTrail
        images={TRAIL}
        touch={false}
        spacing={72}
        duration={1100}
        imageSize={size}
        cornerRadius={12}
        fadeInDuration={0.3}
        fadeOutDuration={0.55}
        fadeOutBlur={6}
        maxTrailImages={24}
        className={cn(styles.trail, "cursor-auto overflow-visible")}
      >
        <div className={styles.inner}>
          <h1 id="work-heading" className={styles.headline}>
            Work that&rsquo;s impossible
            <br /> to ignore.
          </h1>
          <p className={styles.lede}>
            Websites, identities and motion for brands that want to be felt, not just seen.
            <span className={styles.hint}> Move across the page to leave a trail through the work.</span>
          </p>
        </div>
      </ImageTrail>
    </section>
  );
}
