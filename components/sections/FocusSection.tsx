"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PACKAGES } from "@/components/focus";
import { drawSnake, geometry, type Geometry } from "@/components/sections/SnakeTrail";
import Ticket from "@/components/sections/focus/Ticket";
import RetroDesktop, { type DesktopHandle } from "@/components/sections/focus/RetroDesktop";
import Wallpaper from "@/components/sections/focus/Wallpaper";
import WaveDither from "@/components/ui/wave-dither";
import { useAccent } from "@/lib/accent";
import styles from "./FocusSection.module.css";

// The TV (public/images/focus/tv.webp, 1600 × 1418): the supplied PSD's own cut-out. Its screen hole is
// a superellipse fitted to the glass's rim, with the tube's dark lip and glare baked in along the
// edge so the seam is even all round; this is the hole's bounding box as shares of the image.
const TV = { w: 1600, h: 1418, screen: { x: 0.1255, y: 0.1186, w: 0.6832, h: 0.6354 } };
// The handset on phones (public/images/focus/phone.webp, 1088 × 2192): the supplied HTC Magic cut-out,
// upscaled 4× with Real-ESRGAN (anime model, crisp on product renders), its speaker grille restored
// from the high-res photo and the carrier mark removed; the display is cut on its exact pixel bounds.
const PHONE_DEVICE = { w: 1088, h: 2192, screen: { x: 0.09559, y: 0.13914, w: 0.8125, h: 0.59717 } };

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

/** a·w + b·(1 − w), per sRGB channel. */
function mixHex(a: string, b: string, w: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return "#" + pa.map((c, i) => Math.round(c * w + pb[i] * (1 - w)).toString(16).padStart(2, "0")).join("");
}

/** A tile of TV snow, drawn once on the client. */
function useNoiseTile() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setUrl(c.toDataURL("image/png"));
  }, []);
  return url;
}

/**
 * "I keep my focus on important things": the studio's case, told in one pinned scroll.
 * A white screen blooms into the accent; the snake crosses the line before its key words come
 * into focus; the packages roll in as tickets (hover tears the stub into a call to action);
 * then the whole screen turns out to be a window on a retro desktop, files and all, and the
 * desktop pulls back into the old TV it was playing on (a handset on phones).
 */
export default function FocusSection() {
  const phone = usePhone();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const crtRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<DesktopHandle>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const keyRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const finderRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const distanceRef = useRef<HTMLDivElement>(null);
  const packagesRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLParagraphElement>(null);
  const ticketRefs = useRef<(HTMLElement | null)[]>([]);
  const snakeBodyRef = useRef<SVGPathElement>(null);
  const snakeHeadRef = useRef<SVGGElement>(null);
  const snakeFlipRef = useRef<SVGGElement>(null);
  const [live, setLive] = useState(false);
  const [floating, setFloating] = useState(false);
  const noise = useNoiseTile();
  const accent = useAccent();
  // The tide's height, written by the scroll timeline and read by the shader each frame.
  const tideRef = useRef(0);
  // 0 → 1 as the white ground under the tide turns to the accent's deep ground.
  const groundRef = useRef(0);
  // Under the tickets' live glass every wave redraw costs a full refraction, so the wave steps
  // at ~15fps there (it is a stepped dither; the motion reads the same) and 30fps elsewhere.
  const waveIntervalRef = useRef(31);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    const stage = stageRef.current;
    const rig = rigRef.current;
    const screen = screenRef.current;
    const ui = uiRef.current;
    const scene = sceneRef.current;
    const desk = deskRef.current;
    if (!section || !stage || !rig || !screen || !ui || !scene || !desk) return;
    const tickets = ticketRefs.current.filter(Boolean) as HTMLElement[];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const device = phone ? PHONE_DEVICE : TV;

    // Everything the timeline's start values depend on, re-measured on every refresh.
    const geo = { rigX: 0, rigY: 0, rigS: 1, zoomX: 0, zoomY: 0, zoomS: 1, snakeStart: 0, snakeEnd: 0, fx0: 0, fy0: 0, fx1: 0, fy1: 0 };
    let snake: Geometry | null = null;

    const measure = () => {
      const vw = stage.clientWidth;
      const vh = stage.clientHeight;
      // The device at rest: centred, as large as the screen allows.
      const devW = phone ? Math.min(vw * 0.8, vh * 0.82 * (device.w / device.h)) : Math.min(vw * 0.62, vh * 0.74 * (device.w / device.h));
      const devH = devW * (device.h / device.w);
      const left = (vw - devW) / 2;
      const top = (vh - devH) / 2;
      Object.assign(rig.style, { left: `${left}px`, top: `${top}px`, width: `${devW}px`, height: `${devH}px` });
      const sx = devW * device.screen.x;
      const sy = devH * device.screen.y;
      const sw = devW * device.screen.w;
      const sh = devH * device.screen.h;
      Object.assign(screen.style, { left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px` });
      // The desktop is one viewport, fitted inside the screen (a margin keeps the TV's rounded
      // corners clear of the icons), so it can start the timeline as exactly the page.
      const k = Math.min(sw / vw, sh / vh) * (phone ? 1 : 0.92);
      const ox = (sw - vw * k) / 2;
      const oy = (sh - vh * k) / 2;
      Object.assign(ui.style, { width: `${vw}px`, height: `${vh}px`, transform: `translate(${ox}px, ${oy}px) scale(${k})` });
      ui.style.setProperty("--ui-ar", `${vw} / ${vh}`);
      // Rig transform that maps the desktop back onto the viewport one to one.
      geo.rigS = 1 / k;
      geo.rigX = -left - (sx + ox) / k;
      geo.rigY = -top - (sy + oy) / k;

      // The Pricing window, zoomed so its body is the whole desktop.
      const { win, bar, body } = desk.pricing();
      if (win && bar && body) {
        const s = vw / body.offsetWidth;
        geo.zoomS = s;
        geo.zoomX = -win.offsetLeft;
        geo.zoomY = -win.offsetTop - bar.offsetHeight;
      }

      // The viewfinder frames the key words: their box, padded, in scene px.
      const key = keyRef.current;
      const finder = finderRef.current;
      if (key && finder) {
        const pad = Math.max(18, key.offsetHeight * 0.22);
        const box = { x: key.offsetLeft - pad, y: key.offsetTop - pad * 0.7, w: key.offsetWidth + pad * 2, h: key.offsetHeight + pad * 1.4 };
        // Keep the brackets off the screen's edges where the words nearly fill the width (phones).
        const edge = 12;
        if (box.x < edge) {
          box.w -= (edge - box.x) * 2;
          box.x = edge;
        }
        Object.assign(finder.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
        // How far each corner travels from the screen's corners to the box's.
        geo.fx0 = -box.x;
        geo.fy0 = -box.y;
        geo.fx1 = scene.clientWidth - (box.x + box.w);
        geo.fy1 = scene.clientHeight - (box.y + box.h);
      }

      snake = geometry(scene.clientWidth, scene.clientHeight);
      geo.snakeStart = scene.clientHeight + snake.thick * 2;
      geo.snakeEnd = -snake.length - snake.thick * 3;
    };

    const paintSnake = (y: number) => {
      if (!snake || !snakeBodyRef.current || !snakeHeadRef.current) return;
      const { body, head } = drawSnake(snake, y);
      snakeBodyRef.current.setAttribute("d", body);
      snakeHeadRef.current.setAttribute("transform", head);
    };

    measure();

    if (reduce) {
      // No pin: the finished TV, desktop live, every package readable in its window.
      gsap.set(rig, { x: 0, y: 0, scale: 1 });
      tideRef.current = 0.6;
      groundRef.current = 1;
      gsap.set(headlineRef.current, { opacity: 0 });
      gsap.set([finderRef.current, distanceRef.current], { autoAlpha: 0 });
      gsap.set([packagesRef.current, footRef.current], { opacity: 1 });
      gsap.set(crtRef.current, { opacity: 1 });
      paintSnake(geo.snakeEnd);
      setLive(true);
      const onResize = () => measure();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const cleanups: (() => void)[] = [];
    const ctx = gsap.context(() => {
      /*
       * The snake faces the way the page scrolls, like the statement's (SnakeTrail.tsx): scrolling
       * down it rises head first from the foot; scrolling up the same snake is mirrored and comes
       * down head first from the top. It is always drawn in its rising frame, from the progress p
       * (0..1) the timeline scrubs; heading down, that frame is flipped and run from the far end.
       * It only turns around while fully off screen, so it never visibly jumps.
       */
      const snakeProxy = { p: 0 };
      let heading: "up" | "down" = "up";
      let lastP = 0;
      const setFlip = () => {
        const flip = snakeFlipRef.current;
        if (!flip) return;
        if (heading === "down") flip.setAttribute("transform", `translate(0 ${scene.clientHeight}) scale(1 -1)`);
        else flip.removeAttribute("transform");
      };
      const renderSnake = () => {
        const p = snakeProxy.p;
        if (Math.abs(p - lastP) > 1e-4) {
          const wants = p > lastP ? "up" : "down";
          // Off screen: at either end of the crossing.
          if (wants !== heading && (lastP <= 0.001 || lastP >= 0.999 || p <= 0.001 || p >= 0.999)) {
            heading = wants;
            setFlip();
          }
        }
        lastP = p;
        const t = heading === "up" ? p : 1 - p;
        paintSnake(geo.snakeStart + (geo.snakeEnd - geo.snakeStart) * t);
      };
      renderSnake();
      const zoomEl = desk.pricing().zoom;
      let wasLive = false;
      let wasFloating = false;
      // The desktop starts with only the Pricing window; files open when clicked.
      const resetDesktop = () => desk.closeAll();
      // Scrolling down past the section closes them too, once it has left the screen. Off screen,
      // every CSS animation inside (float, CRT glitch, clouds) pauses as well.
      const gone = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) delete section.dataset.offscreen;
        else section.dataset.offscreen = "";
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) resetDesktop();
      });
      gone.observe(section);
      cleanups.push(() => gone.disconnect());

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        // The timeline's own update, not the ScrollTrigger's: the scrub keeps easing after the last
        // scroll event, and state read on scroll went stale (an empty desktop, or windows left over
        // the tickets).
        onUpdate: () => {
          const t = tl.time();
          // From the zoom on, the tickets are a picture in a shrinking window: their live glass
          // would re-refract the whole screen every frame (36ms frames), so it rests as plain smoke.
          waveIntervalRef.current = t >= tl.labels.settled - 0.05 && t < tl.labels.zoom ? 66 : 31;
          // Live only while the tickets rest: flying in or zooming away, moving glass would
          // re-refract every frame, and at that speed plain smoke reads the same.
          const still = t < tl.labels.settled - 0.05 || t >= tl.labels.zoom - 0.05;
          if (still !== (scene.dataset.still !== undefined)) {
            if (still) scene.dataset.still = "";
            else delete scene.dataset.still;
          }
          const isLive = t >= tl.labels.zoom + 0.15;
          if (isLive !== wasLive) {
            setLive((wasLive = isLive));
            // Scrolling back up off the desktop closes what was open; the next pass starts fresh.
            if (!isLive) resetDesktop();
          }
          const isFloating = t >= tl.labels.tv + 1.3;
          if (isFloating !== wasFloating) setFloating((wasFloating = isFloating));
        },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          invalidateOnRefresh: true,
          onRefreshInit: measure,
        },
      });

      // 1. The white screen blooms into the accent, from the foot of the page.
      // A dithered tide in the packages' colour rises from the foot of the screen (Paper Shaders'
      // wave dithering), covering the white page.
      const tide = { v: 0 };
      tl.fromTo(tide, { v: 0 }, { v: 1, duration: 2.4, ease: "power1.inOut", onUpdate: () => (tideRef.current = tide.v) }, 0.25);
      // Covered, the white beneath turns to the accent's deep ground and the tide sinks back to
      // mid-screen, so a two-tone dithered wave keeps rolling behind the headline and the tickets.
      const ground = { v: 0 };
      tl.fromTo(ground, { v: 0 }, { v: 1, duration: 0.6, ease: "power1.inOut", onUpdate: () => (groundRef.current = ground.v) }, 2.35);
      tl.to(tide, { v: 0.6, duration: 0.9, ease: "power2.inOut", onUpdate: () => (tideRef.current = tide.v) }, 2.75);

      // 2. The snake crosses the line, then the key words come into focus.
      tl.fromTo(snakeProxy, { p: 0 }, { p: 1, duration: 1.7, onUpdate: renderSnake }, 1.4);
      // The focus pull. The lead arrives sharp, the key words soft behind it;
      // a viewfinder flies in from the screen's corners, the focus hunts (soft, sharp, soft) while
      // the distance scale racks, then locks: "important things" snaps sharp, the lead stays
      // falls away out of focus, and the AF readout confirms.
      // A rack focus: the lead starts sharp and readable, the key words soft behind it.
      tl.fromTo(leadRef.current, { filter: "blur(0px)", opacity: 1 }, { filter: "blur(0px)", opacity: 1, duration: 0.01 }, 0);
      tl.fromTo(keyRef.current, { filter: "blur(14px)", opacity: 0.85 }, { filter: "blur(14px)", opacity: 0.85, duration: 0.01 }, 0);
      const finder = finderRef.current!;
      const corners = finder.querySelectorAll<HTMLElement>("[data-corner]");
      const from = [
        () => ({ x: geo.fx0, y: geo.fy0 }),
        () => ({ x: geo.fx1, y: geo.fy0 }),
        () => ({ x: geo.fx0, y: geo.fy1 }),
        () => ({ x: geo.fx1, y: geo.fy1 }),
      ];
      tl.fromTo(finder, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 2.75);
      corners.forEach((c, i) => {
        tl.fromTo(c, { x: () => from[i]().x, y: () => from[i]().y }, { x: 0, y: 0, duration: 0.55, ease: "power3.out" }, 2.75);
      });
      tl.fromTo(distanceRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 2.8);
      // The hunt: the scale racks, the key words breathe in and out of focus.
      tl.to(scaleRef.current, { keyframes: [{ x: -160, duration: 0.25 }, { x: 60, duration: 0.2 }, { x: -70, duration: 0.18 }], ease: "power1.inOut" }, 2.95);
      tl.to(keyRef.current, {
        keyframes: [
          { filter: "blur(3px)", opacity: 1, duration: 0.25 },
          { filter: "blur(8px)", duration: 0.2 },
          { filter: "blur(0px)", duration: 0.18 },
        ],
        ease: "power1.inOut",
      }, 2.95);
      // The lead falls out of focus entirely: by the lock only the key words are left in frame.
      tl.to(leadRef.current, { filter: "blur(22px)", opacity: 0, duration: 0.6, ease: "power1.in" }, 2.95);
      // Lock: brackets bite in a touch and back, readout and confirm dot come on.
      tl.to(corners, { keyframes: [{ scale: 0.86, duration: 0.08 }, { scale: 1, duration: 0.14 }] }, 3.58);
      tl.call(() => finder.setAttribute("data-locked", ""), [], 3.6);
      tl.call(() => finder.removeAttribute("data-locked"), [], 3.59);
      tl.fromTo(keyRef.current, { scale: 1 }, { scale: 1.04, duration: 0.3, ease: "power2.out" }, 3.6);

      // 3. The packages roll in as tickets; the line steps back behind them.
      tl.to(headlineRef.current, { filter: "blur(16px)", opacity: 0.35, duration: 0.8 }, 3.9);
      tl.to([finder, distanceRef.current], { autoAlpha: 0, duration: 0.4 }, 3.9);
      let cardsEnd: number;
      if (phone) {
        // One ticket at a time: in, torn, away, and the next.
        tickets.forEach((t, i) => {
          const at = 3.9 + i * 1.75;
          tl.fromTo(t, { yPercent: 190, rotationY: -105, rotationZ: -7, autoAlpha: 1 }, { yPercent: 0, rotationY: 0, rotationZ: 0, duration: 0.85, ease: "power3.out" }, at);
          tl.fromTo(t, { "--rip": 0 }, { "--rip": 1, duration: 0.45, ease: "back.out(2.2)" }, at + 0.95);
          if (i < tickets.length - 1) tl.to(t, { yPercent: -28, rotationZ: -9, autoAlpha: 0, duration: 0.5, ease: "power2.in" }, at + 1.55);
        });
        cardsEnd = 3.9 + (tickets.length - 1) * 1.75 + 1.5;
      } else {
        // One tween per ticket: a staggered fromTo left the later tickets at rest until they started.
        tickets.forEach((t, i) => {
          tl.fromTo(
            t,
            { yPercent: 175, rotationY: -115, rotationZ: -8 },
            { yPercent: 0, rotationY: 0, rotationZ: 0, duration: 1.2, ease: "power3.out", immediateRender: true },
            3.85 + i * 0.38,
          );
        });
        cardsEnd = 3.85 + 1.2 + 0.38 * (tickets.length - 1);
      }
      tl.fromTo([packagesRef.current, footRef.current], { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.12, ease: "power2.out" }, cardsEnd - 0.5);

      // 4. The screen was a window all along: it zooms down onto a retro desktop.
      // The tickets have landed: their glass goes live from here until the zoom.
      tl.addLabel("settled", cardsEnd);
      tl.addLabel("zoom", cardsEnd + 1.2);
      tl.fromTo(
        zoomEl,
        { x: () => geo.zoomX, y: () => geo.zoomY, scale: () => geo.zoomS },
        { x: 0, y: 0, scale: 1, duration: 1.3, ease: "power2.inOut" },
        "zoom",
      );

      // 5. And the desktop was on a TV: pull back until the set floats on the page.
      tl.addLabel("tv", "zoom+=3.4");
      tl.fromTo(rig, { x: () => geo.rigX, y: () => geo.rigY, scale: () => geo.rigS }, { x: 0, y: 0, scale: 1, duration: 1.5, ease: "power2.inOut" }, "tv");
      // The glass's scanlines come in once the set is small enough to read as a TV, not over the desktop.
      tl.fromTo(crtRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6 }, "tv+=0.85");
      tl.to({}, { duration: 1 });

      section.style.setProperty("--units", tl.duration().toFixed(2));
    }, section);
    // The track's height comes from the timeline's length, so measure again once it is set.
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
      cleanups.forEach((fn) => fn());
    };
  }, [phone]);

  return (
    <section ref={sectionRef} className={styles.focus} aria-labelledby="focus-heading" data-scene="Packages">
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.float} data-floating={floating ? "" : undefined}>
          <div ref={rigRef} className={styles.rig}>
            <div ref={screenRef} className={styles.screen} data-awake={live ? "" : undefined}>
              <Wallpaper className={styles.wallpaper} />
              <div ref={uiRef} className={styles.ui}>
                <RetroDesktop
                  ref={deskRef}
                  phone={phone}
                  live={live}
                  pricing={
                    <div ref={sceneRef} className={styles.scene}>
                      <WaveDither
                        className={styles.tide}
                        back="#f4f3f1"
                        backTo={mixHex(accent.plasma, accent.deep, 0.5)}
                        phase={groundRef}
                        interval={waveIntervalRef}
                        front={mixHex(accent.lavender, accent.lilac, 0.72)}
                        level={tideRef}
                      />
                      <svg className={styles.snake} aria-hidden="true">
                        <g ref={snakeFlipRef}>
                          <path ref={snakeBodyRef} />
                          <g ref={snakeHeadRef}>
                            <circle r="8.4" />
                            <path d="M0 4 C-9 2 -13 -8 -12 -16 C-11 -24 -5 -31 0 -32 C5 -31 11 -24 12 -16 C13 -8 9 2 0 4Z" />
                          </g>
                        </g>
                      </svg>
                      <h2 ref={headlineRef} id="focus-heading" className={styles.headline}>
                        <span ref={leadRef} className={styles.lead}>
                          I keep my focus on
                        </span>
                        <span ref={keyRef} className={styles.key}>
                          important things
                        </span>
                      </h2>
                      {/* The viewfinder that pulls focus onto the key words. */}
                      <div ref={finderRef} className={styles.finder} aria-hidden="true">
                        <span data-corner className={`${styles.corner} ${styles.tl}`} />
                        <span data-corner className={`${styles.corner} ${styles.tr}`} />
                        <span data-corner className={`${styles.corner} ${styles.bl}`} />
                        <span data-corner className={`${styles.corner} ${styles.br}`} />
                        <span className={styles.readout}>
                          <i className={styles.confirm} />
                          AF-S · <b>Locked</b>
                        </span>
                      </div>
                      <div ref={distanceRef} className={styles.distance} aria-hidden="true">
                        <div ref={scaleRef} className={styles.ruler}>
                          {["0.3", "0.5", "0.7", "1", "1.5", "2", "3", "5", "10", "∞"].map((m) => (
                            <span key={m}>{m}</span>
                          ))}
                        </div>
                        <i className={styles.needle} />
                      </div>

                      {/* One stack, one rhythm: heading, tickets, note, centred under the nav bar. */}
                      <div className={styles.deck}>
                        <div ref={packagesRef} className={styles.packages}>
                          <h3 className={styles.packagesTitle}>Packages</h3>
                        </div>
                        <div className={styles.tickets}>
                          {PACKAGES.map((pkg, i) => (
                            <Ticket
                              key={pkg.id}
                              pkg={pkg}
                              index={i}
                              className={styles.ticket}
                              ref={(el) => {
                                ticketRefs.current[i] = el;
                              }}
                            />
                          ))}
                        </div>
                        <p ref={footRef} className={styles.foot}>
                          <em>Quality is non-negotiable.</em>
                          <span>
                            Every package, every project: responsive, fast, accessible, tested across browsers and built on clean
                            code.
                          </span>
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div ref={crtRef} className={styles.crt} aria-hidden="true">
                <span className={styles.grain} style={noise ? { backgroundImage: `url(${noise})` } : undefined} />
                <span className={styles.roll} />
                <span className={`${styles.band} ${styles.bandA}`} />
                <span className={`${styles.band} ${styles.bandB}`} />
                <span className={`${styles.band} ${styles.bandC}`} />
                <span className={styles.flash} />
              </div>
            </div>
            {phone ? (
              <div className={styles.device} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/focus/phone.webp" alt="" className={styles.tvImage} decoding="async" />
              </div>
            ) : (
              <div className={styles.device} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/focus/tv.webp" alt="" className={styles.tvImage} decoding="async" />
                <div className={styles.tvTint} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
