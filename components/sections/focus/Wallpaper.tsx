import styles from "./Wallpaper.module.css";

/*
 * The desktop's wallpaper: a dusk over rolling hills, painted from the accent tokens so it
 * re-themes with the site. The land answers the sky: a low sun glows behind the ridge and
 * catches its crest, the far hills sink into the sky's haze, the near hill carries the footer's
 * contour lines, and a path winds up it in the logo snake's curve. Static SVG (rasterised once);
 * only the clouds move, each on its own composited layer.
 */

// Cumulus banks: [top %, width % of the screen, drift seconds, start offset 0..1]. Higher clouds
// are bigger and nearer, so they drift faster; the low ones crawl along the horizon.
const CLOUDS: [number, number, number, number][] = [
  [6, 27, 95, 0.05],
  [14, 34, 120, 0.55],
  [3, 19, 80, 0.8],
  [27, 20, 150, 0.3],
  [34, 25, 170, 0.72],
  [41, 16, 190, 0.12],
];

/** One cloud: a flat base with puffs heaped on it, shaded underneath, softened by a blur. The
 * viewBox leaves room around the art, so the blur never meets the edge and gets cut off. */
function Cloud({ seed }: { seed: number }) {
  const puffs = 5 + (seed % 3);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < puffs; i++) {
    const t = (i + 0.5) / puffs;
    const r = 400 * (0.11 + 0.09 * Math.sin(t * Math.PI) + 0.03 * Math.sin(seed * 3.1 + i * 1.7));
    out.push(<circle key={i} cx={20 + t * 360} cy={150 - r * 0.55} r={r} />);
  }
  return (
    <svg viewBox="-80 -40 560 280" className={styles.cloudArt} aria-hidden="true">
      <defs>
        <filter id={`wp-cloud-${seed}`} filterUnits="userSpaceOnUse" x="-80" y="-40" width="560" height="280">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <linearGradient id={`wp-cloud-shade-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--lilac) 55%, #fff)" }} />
        </linearGradient>
      </defs>
      <g filter={`url(#wp-cloud-${seed})`} fill={`url(#wp-cloud-shade-${seed})`} opacity="0.94">
        {out}
        <ellipse cx="200" cy="152" rx="206" ry="28" />
      </g>
    </svg>
  );
}

const W = 1600;
// The near hill's crest; contour lines are copies of it, sunk further down the slope.
const RIDGE = "M-40 742C220 650 520 600 860 612C1130 622 1360 676 1640 752";

/** The path up the near hill: a ribbon along the snake's S, wide at the foot, a thread at the crest. */
function trail() {
  const n = 48;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 at the foot, 1 at the crest
    const y = 1010 - t * 392;
    const x = 760 + 170 * Math.sin(t * Math.PI * 1.6 + 0.4) * (1 - t * 0.7);
    const half = 46 * (1 - t) ** 1.6 + 1.2;
    left.push(`${(x - half).toFixed(1)} ${y.toFixed(1)}`);
    right.push(`${(x + half).toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
}

export default function Wallpaper({ className }: { className?: string }) {
  return (
    <div className={`${styles.wallpaper} ${className ?? ""}`} aria-hidden="true">
      <svg className={styles.layer} viewBox={`0 0 ${W} 1000`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--lavender) 78%, var(--plasma))" }} />
            <stop offset="0.38" style={{ stopColor: "color-mix(in oklab, var(--lavender) 55%, var(--lilac))" }} />
            <stop offset="0.62" style={{ stopColor: "color-mix(in oklab, var(--lilac) 70%, #fff)" }} />
          </linearGradient>
          <radialGradient id="wp-sun" cx="1120" cy="610" r="560" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.12" style={{ stopColor: "color-mix(in oklab, var(--highlight) 30%, #fff)" }} stopOpacity="0.7" />
            <stop offset="0.45" style={{ stopColor: "var(--lilac)" }} stopOpacity="0.25" />
            <stop offset="1" style={{ stopColor: "var(--lilac)" }} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height="1000" fill="url(#wp-sky)" />
        <rect width={W} height="1000" fill="url(#wp-sun)" />
      </svg>

      {/* Clouds drift between the sky and the hills. */}
      <div className={styles.clouds}>
        {CLOUDS.map(([top, width, seconds, offset], i) => (
          <div
            key={i}
            className={styles.lane}
            style={{ top: `${top}%`, "--w": `${width}%`, animationDuration: `${seconds}s`, animationDelay: `${-offset * seconds}s` } as React.CSSProperties}
          >
            <Cloud seed={i} />
          </div>
        ))}
      </div>

      <svg className={styles.layer} viewBox={`0 0 ${W} 1000`} preserveAspectRatio="xMidYMax slice">
        <defs>
          {/* Aerial perspective: the further the hill, the more it takes the sky's haze. */}
          <linearGradient id="wp-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--lilac) 55%, #fff)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--lilac) 70%, var(--lavender))" }} />
          </linearGradient>
          <linearGradient id="wp-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--lilac) 62%, var(--lavender))" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--lavender) 75%, var(--lilac))" }} />
          </linearGradient>
          <linearGradient id="wp-near" x1="0" y1="600" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--lavender) 58%, var(--lilac))" }} />
            <stop offset="0.45" style={{ stopColor: "color-mix(in oklab, var(--lavender) 85%, var(--plasma))" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--lavender) 45%, var(--plasma))" }} />
          </linearGradient>
          {/* Sunlight raking across the slope from the right. */}
          <radialGradient id="wp-sheen" cx="1120" cy="640" r="760" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="0.5" style={{ stopColor: "var(--lilac)" }} stopOpacity="0.12" />
            <stop offset="1" style={{ stopColor: "var(--lilac)" }} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wp-trail" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--bone) 80%, var(--lilac))" }} stopOpacity="0.85" />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--lilac) 50%, #fff)" }} stopOpacity="0.9" />
          </linearGradient>
          <clipPath id="wp-near-clip">
            <path d={`${RIDGE}V1040H-40Z`} />
          </clipPath>
          <filter id="wp-rim" x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          <filter id="wp-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0" />
          </filter>
        </defs>

        <path d="M-40 640C200 600 420 596 640 618C860 640 1080 610 1300 586C1440 572 1540 580 1640 596V1000H-40Z" fill="url(#wp-far)" opacity="0.9" />
        <path d="M-40 690C160 640 360 640 560 668C740 692 900 680 1060 654C1260 622 1460 640 1640 680V1000H-40Z" fill="url(#wp-mid)" />
        <path d={`${RIDGE}V1040H-40Z`} fill="url(#wp-near)" />
        <path d={`${RIDGE}V1040H-40Z`} fill="url(#wp-sheen)" />

        <g clipPath="url(#wp-near-clip)">
          {/* The footer's contour lines, laid along the slope. */}
          <g fill="none" style={{ stroke: "color-mix(in oklab, var(--lilac) 70%, #fff)" }} strokeWidth="1.4">
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={RIDGE} transform={`translate(${(i % 2) * 24 - 12} ${34 + i * i * 6.5}) scale(1 ${1 - i * 0.035})`} opacity={0.32 - i * 0.03} />
            ))}
          </g>
          <path d={trail()} fill="url(#wp-trail)" />
        </g>

        {/* Rim light along the crest, where the low sun catches it. */}
        <path d={RIDGE} fill="none" style={{ stroke: "color-mix(in oklab, var(--highlight) 35%, #fff)" }} strokeWidth="5" opacity="0.55" filter="url(#wp-rim)" />
        <path d={RIDGE} fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.5" />

        <rect width={W} height="1000" filter="url(#wp-grain)" />
      </svg>
    </div>
  );
}
