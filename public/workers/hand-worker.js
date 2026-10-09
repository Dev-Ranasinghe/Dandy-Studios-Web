/*
 * Hand tracking off the main thread (classic worker: MediaPipe's loader uses importScripts).
 * It loads first and reports real progress, so the page can hold the camera off until the
 * tracker is ready. Then the page posts downscaled frames as ImageBitmaps and this worker
 * posts back normalised landmarks, so detection never blocks scrolling or paint.
 */
const BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";

let landmarker = null;

const progress = (p, stage, extra) => self.postMessage({ type: "progress", p, stage, ...extra });

async function fetchWithProgress(url, from, to) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`model ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastPost = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const now = performance.now();
    if (total && now - lastPost > 80) {
      lastPost = now;
      progress(from + (to - from) * (loaded / total), "model", { loaded, total });
    }
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function init(model) {
  progress(0.04, "runtime");
  importScripts(`${BASE}/vision_bundle.js`);
  const { FilesetResolver, HandLandmarker } = self.Vision;
  const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  progress(0.16, "runtime");

  const buffer = await fetchWithProgress(model, 0.16, 0.78);
  progress(0.8, "compile");

  const options = (delegate) => ({
    baseOptions: { modelAssetBuffer: buffer, delegate },
    runningMode: "VIDEO",
    numHands: 2,
    ...(delegate === "GPU" ? { canvas: new OffscreenCanvas(1, 1) } : {}),
  });
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    landmarker = await HandLandmarker.createFromOptions(fileset, options("CPU"));
  }
  progress(0.88, "compile");
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await init(msg.model);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }
  if (msg.type === "frame") {
    const bitmap = msg.bitmap;
    let hands = [];
    try {
      if (landmarker) {
        const result = landmarker.detectForVideo(bitmap, performance.now());
        hands = result.landmarks.map((hand) => hand.map(({ x, y }) => ({ x, y })));
      }
    } catch {
      /* A dropped frame; the next one will do. */
    } finally {
      bitmap.close();
    }
    self.postMessage({ type: "result", hands });
  }
};
