"use client";

import { CrowdCanvas } from "@/components/ui/skiper39";
import styles from "./CrowdSection.module.css";

/**
 * Between the testimonials and the closing call to action: the people the work is for,
 * walking past in line (Open Peeps, via Skiper UI's crowd canvas). Transparent over the
 * page's bone ground; the band fades out at its foot, so the crowd dissolves into the paper
 * instead of stopping at a hard edge.
 */
export default function CrowdSection() {
  return (
    <div className={styles.section} aria-hidden="true">
      <CrowdCanvas src="/images/open-peeps-crowd.png" rows={15} cols={7} className={styles.canvas} />
    </div>
  );
}
