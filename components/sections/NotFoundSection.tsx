"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { Globe } from "@/components/ui/cosmic-404";
import GlassLayer from "@/components/ui/GlassLayer";
import styles from "./NotFoundSection.module.css";

const EASE = [0.16, 1, 0.3, 1] as const;

/** The 4s start pressed together over the globe's place, then part to let it rise between them. */
const digit = (side: -1 | 1): Variants => ({
  hidden: { x: `${side * -0.42}em`, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 1.1, ease: EASE, delay: 0.1 } },
});

const globe: Variants = {
  hidden: { scale: 0.4, opacity: 0, y: "0.25em" },
  visible: { scale: 1, opacity: 1, y: 0, transition: { duration: 1.3, ease: EASE, delay: 0.35 } },
};

const copy: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: 0.7 + i * 0.09 } }),
};

export interface NotFoundSectionProps {
  title?: string;
  description?: string;
}

/**
 * The site's 404: every page that doesn't exist yet lands here. A Caslon 4-globe-4 on the bone
 * ground, the globe in the visitor's accent (grab it to spin), and two ways back.
 */
export default function NotFoundSection({
  title = "This page is still in the sketchbook.",
  description = "It hasn't been built yet, or it has moved. The finished work is one click away.",
}: NotFoundSectionProps) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const initial = reduced ? false : "hidden";

  return (
    <section className={styles.page} aria-labelledby="not-found-heading">
      <div className={styles.field} aria-hidden />
      <div className={styles.grid} aria-hidden />

      <motion.div className={styles.inner} initial={initial} animate="visible">
        <div className={styles.code}>
          <span className="sr-only">Error 404</span>
          <motion.span className={styles.digit} variants={digit(-1)} aria-hidden>
            4
          </motion.span>
          <motion.div className={styles.globe} variants={globe}>
            <Globe label="A dotted globe. Drag to spin it." />
          </motion.div>
          <motion.span className={styles.digit} variants={digit(1)} aria-hidden>
            4
          </motion.span>
        </div>

        <motion.h1 id="not-found-heading" className={styles.headline} variants={copy} custom={0}>
          {title}
        </motion.h1>

        <motion.p className={styles.lede} variants={copy} custom={1}>
          {description}
        </motion.p>

        {pathname && pathname !== "/" && (
          <motion.p className={styles.path} variants={copy} custom={2}>
            <span className={`marker ${styles.pathMark}`}>
              <span aria-hidden>( </span>
              {pathname}
              <span aria-hidden> )</span>
            </span>
            <span className={styles.pathNote}>not drawn yet</span>
          </motion.p>
        )}

        <motion.div className={styles.actions} variants={copy} custom={3}>
          <a className={`${styles.key} ${styles.keySolid} glass-host glass-solid`} href="/">
            <GlassLayer />
            <ArrowLeft className={styles.keyIconBack} aria-hidden />
            Back home
          </a>
          <a className={`${styles.key} ${styles.keyClear} glass-host`} href="/work">
            <GlassLayer />
            See the work
            <ArrowUpRight className={styles.keyIcon} aria-hidden />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
