"use client";

import { useEffect, useRef } from "react";
import { whenSettled } from "@/lib/settle";

/**
 * Camera mode: the visitor's own camera, mirrored, behind the hero's type. Hand tracking
 * runs on-device in a Web Worker (MediaPipe, loaded only now) so it never blocks the page;
 * this component only pumps small frames to it and draws the joints it sends back. The
 * index fingertip is handed on so it can steer the cursor field. Nothing leaves the browser.
 */

export type CameraStatus = "off" | "starting" | "active" | "blocked" | "missing" | "unsupported";
export type StartStage = "runtime" | "model" | "compile" | "camera" | "warm" | "ready";

type Props = {
  onStatus: (status: CameraStatus) => void;
  onFingertip: (point: { x: number; y: number } | null) => void;
  /** Loading progress, 0..1, with the stage it is in. */
  onProgress?: (p: number, stage: StartStage, bytes?: { loaded: number; total: number }) => void;
  /** Startup is finished and the camera is live: tracking is running (true) or unavailable (false). */
  onReady?: (tracking: boolean) => void;
  videoClassName?: string;
  canvasClassName?: string;
};

const TIPS = new Set([4, 8, 12, 16, 20]);
const DETECT_WIDTH = 384; // frames sent to the model; landmarks come back normalised, so size only costs time
const DETECT_INTERVAL = 1000 / 24; // ms; the skeleton reads as live well below the camera's 30–60fps

type Hand = { x: number; y: number }[];

export default function HeroCamera({ onStatus, onFingertip, onProgress, onReady, videoClassName, canvasClassName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onStatus, onFingertip, onProgress, onReady });
  callbacks.current = { onStatus, onFingertip, onProgress, onReady };

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let worker: Worker | null = null;
    let ready = false;
    let busy = false;
    let lastSent = 0;
    let pump = 0;
    let drewHands = false;
    let width = 0;
    let height = 0;

    const status = (s: CameraStatus) => !cancelled && callbacks.current.onStatus(s);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Maps a normalised landmark to canvas space, mirrored, through the video's object-fit: cover crop.
    const project = (nx: number, ny: number) => {
      const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
      const vw = video.videoWidth * scale;
      const vh = video.videoHeight * scale;
      return { x: width - (nx * vw - (vw - width) / 2), y: ny * vh - (vh - height) / 2 };
    };

    const draw = (hands: Hand[]) => {
      if (!hands.length) {
        if (drewHands) ctx.clearRect(0, 0, width, height);
        drewHands = false;
        callbacks.current.onFingertip(null);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      drewHands = true;

      const all = hands.map((hand) => hand.map((l) => project(l.x, l.y)));
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(244, 243, 241, 0.7)";
      ctx.beginPath();
      for (const pts of all) {
        for (const [a, b] of HAND_LINKS) {
          ctx.moveTo(pts[a].x, pts[a].y);
          ctx.lineTo(pts[b].x, pts[b].y);
        }
      }
      ctx.stroke();

      // Constellation lines from the wrist and thumb out to the nearest frame edge.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(244, 243, 241, 0.45)";
      ctx.beginPath();
      for (const pts of all) {
        for (const i of [0, 4]) {
          const p = pts[i];
          const edges = [
            { d: p.x, x: 0, y: p.y + (height / 2 - p.y) * 0.4 },
            { d: width - p.x, x: width, y: p.y + (height / 2 - p.y) * 0.4 },
            { d: height - p.y, x: p.x + (width / 2 - p.x) * 0.3, y: height },
          ];
          const edge = edges.reduce((m, e) => (e.d < m.d ? e : m));
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(edge.x, edge.y);
        }
      }
      ctx.stroke();

      ctx.fillStyle = "#f4f3f1";
      ctx.beginPath();
      for (const pts of all) {
        pts.forEach((p, i) => {
          const r = TIPS.has(i) ? 9 : 2.5;
          ctx.moveTo(p.x + r, p.y);
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        });
      }
      ctx.fill();

      callbacks.current.onFingertip(all[0][8]);
    };

    // Sends at most one small frame at a time, and no faster than DETECT_INTERVAL.
    const schedule = () => {
      if (cancelled) return;
      if ("requestVideoFrameCallback" in video) pump = video.requestVideoFrameCallback(send);
      else pump = requestAnimationFrame(send);
    };
    const send = () => {
      if (cancelled) return;
      const now = performance.now();
      if (!ready || busy || now - lastSent < DETECT_INTERVAL || video.readyState < 2 || document.hidden) {
        schedule();
        return;
      }
      busy = true;
      lastSent = now;
      const w = DETECT_WIDTH;
      const h = Math.round((DETECT_WIDTH * video.videoHeight) / video.videoWidth) || 216;
      createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: "low" })
        .then((bitmap) => {
          if (cancelled || !worker) return bitmap.close();
          worker.postMessage({ type: "frame", bitmap }, [bitmap]);
        })
        .catch(() => {
          busy = false;
        });
      schedule();
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        status("unsupported");
        return;
      }
      status("starting");
      const progress = (p: number, stage: StartStage, bytes?: { loaded: number; total: number }) =>
        !cancelled && callbacks.current.onProgress?.(p, stage, bytes);

      // 1. The tracker loads first (runtime, model, compile) with real progress. The camera
      //    stays off meanwhile, so its light only comes on once everything is ready.
      const tracking = await new Promise<boolean>((resolve) => {
        try {
          worker = new Worker("/workers/hand-worker.js");
        } catch {
          resolve(false);
          return;
        }
        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.type === "progress") progress(msg.p, msg.stage, msg.total ? { loaded: msg.loaded, total: msg.total } : undefined);
          else if (msg.type === "ready") resolve(true);
          else if (msg.type === "error") {
            worker?.terminate();
            worker = null;
            resolve(false);
          } else if (msg.type === "result") {
            busy = false;
            if (!cancelled) draw(msg.hands);
          }
        };
        worker.postMessage({ type: "init", model: new URL("/models/hand_landmarker.task", location.href).href });
      });
      if (cancelled) return;

      // 2. Only now the camera, after the compile has settled.
      await whenSettled();
      if (cancelled) return;
      progress(0.9, "camera");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        const name = (err as DOMException)?.name;
        status(name === "NotFoundError" || name === "OverconstrainedError" ? "missing" : "blocked");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});

      // 3. Wait for a real first frame and a calm page, then reveal and start tracking.
      progress(0.96, "warm");
      if ("requestVideoFrameCallback" in video) {
        await new Promise<void>((resolve) => video.requestVideoFrameCallback(() => resolve()));
      }
      await whenSettled();
      if (cancelled) return;
      progress(1, "ready");
      status("active");
      ready = tracking;
      callbacks.current.onReady?.(tracking);
      if (tracking) schedule();
    })();

    return () => {
      cancelled = true;
      if ("cancelVideoFrameCallback" in video) video.cancelVideoFrameCallback(pump);
      else cancelAnimationFrame(pump);
      ro.disconnect();
      worker?.terminate();
      stream?.getTracks().forEach((t) => t.stop());
      callbacks.current.onFingertip(null);
    };
  }, []);

  return (
    <>
      <video ref={videoRef} className={videoClassName} muted playsInline aria-hidden="true" />
      <canvas ref={canvasRef} className={canvasClassName} aria-hidden="true" />
    </>
  );
}

// The 21-point hand skeleton (MediaPipe's HAND_CONNECTIONS).
const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
] as const;
