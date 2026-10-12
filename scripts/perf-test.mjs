#!/usr/bin/env node
/**
 * Scroll-smoothness test. Drives a Chrome started with --remote-debugging-port over CDP,
 * wheels through a page the way a visitor would, and reports frame times per section plus the
 * hottest functions from a CPU profile. Exits non-zero when the page misses the budget.
 *
 *   node scripts/perf-test.mjs [url] [--port 9333] [--mobile] [--profile] [--loader] [--idle]
 *
 * By default the session's loader is marked as seen so the page itself is measured;
 * --loader measures the loading screen instead (sitting idle: it waits for the visitor to draw),
 * and --idle measures the top of the page without scrolling.
 */
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3100/";
const port = Number(opt("--port", 9333));
const mobile = flag("--mobile");
const profile = flag("--profile");
const loader = flag("--loader");
const idle = loader || flag("--idle");

// Budget: p95 frame under ~2 vsyncs and few janky frames.
const P95_BUDGET = Number(opt("--p95", 25));
const JANK_BUDGET = Number(opt("--jank", 5)); // % of frames over 34ms

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const listeners = new Map();
ws.addEventListener("message", ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) listeners.get(msg.method)?.forEach((fn) => fn(msg.params));
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

await send("Page.enable");
await send("Runtime.enable");
const console_ = [];
on("Runtime.consoleAPICalled", (p) => p.type === "error" && console_.push(p.args.map((a) => a.value ?? a.description).join(" ")));

const [w, h] = mobile ? [440, 956] : [1440, 900];
await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 3 : 2, mobile });
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

// Page-side frame recorder, installed before any app script runs.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__perf = { frames: [], loaf: [], recording: false };
    ${loader ? "" : 'try { sessionStorage.setItem("dandy-loaded", "1"); } catch {}'}
    (function tick(prev) {
      requestAnimationFrame((now) => {
        if (window.__perf.recording && prev) {
          window.__perf.frames.push([now - prev, scrollY]);
        }
        tick(now);
      });
    })(0);
    try {
      new PerformanceObserver((list) => {
        if (!window.__perf.recording) return;
        for (const e of list.getEntries()) window.__perf.loaf.push({
          duration: e.duration, blocking: e.blockingDuration,
          scripts: (e.scripts || []).map((s) => ({ d: s.duration, src: (s.sourceURL || '').split('/').pop() + ':' + s.sourceFunctionName, inv: s.invoker })),
        });
      }).observe({ type: 'long-animation-frame', buffered: false });
    } catch {}
  `,
});

await send("Page.navigate", { url });
await new Promise((r) => on("Page.loadEventFired", r));
// Let the hero settle (or the loader's countdown finish).
await sleep(loader ? 2500 : idle ? 8000 : 4000);

const height = await evaluate("document.documentElement.scrollHeight");
if (profile) {
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 200 });
  await send("Profiler.start");
}
// Section boundaries (document y), so each frame can be attributed by scroll position.
const sections = await evaluate(`[...document.querySelectorAll('main > section, main > div > section, footer')]
  .filter((el) => el.offsetHeight > 200)
  .map((el) => { const r = el.getBoundingClientRect(); return { name: (el.id || el.getAttribute('aria-label') || (el.className.toString().match(/[A-Za-z]+Section|[A-Za-z]+_[a-z]+/) || [el.tagName])[0]).slice(0, 32), top: r.top + scrollY, bottom: r.bottom + scrollY }; })`);
const sectionAt = (y) => (sections.find((s) => y + h / 2 >= s.top && y + h / 2 < s.bottom) ?? { name: "other" }).name;
await evaluate("window.__perf.recording = true");

// Wheel down the whole page at a steady visitor pace. The loading screen just sits there until
// the visitor draws, so --loader measures it idle instead.
const step = mobile ? 180 : 120;
const t0 = Date.now();
if (idle) await sleep(4000);
else
  for (let stuck = 0; stuck < 8; ) {
    const before = await evaluate("scrollY");
    if (mobile) {
      await send("Input.synthesizeScrollGesture", { x: w / 2, y: h * 0.7, yDistance: -step * 3, speed: 1600, gestureSourceType: "touch" });
    } else {
      await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: w / 2, y: h / 2, deltaX: 0, deltaY: step });
      await sleep(50);
    }
    const at = await evaluate("scrollY");
    stuck = at > before + 1 ? 0 : stuck + 1;
    if (at + h >= height - 4 || Date.now() - t0 > 120000) break;
  }
await sleep(1500);
await evaluate("window.__perf.recording = false");

let profileNodes = null;
if (profile) profileNodes = (await send("Profiler.stop")).profile;

const { frames, loaf } = await evaluate("window.__perf");
const fps = (arr) => {
  const s = arr.map((f) => f[0]).sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
  return { n: s.length, fps: +(1000 / mean).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +q(1).toFixed(1), jank: +((100 * s.filter((d) => d > 34).length) / (s.length || 1)).toFixed(1) };
};

const total = fps(frames);
const bySection = {};
for (const f of frames) (bySection[sectionAt(f[1])] ??= []).push(f);
console.log(`\n${mobile ? "PHONE 440x956" : "DESKTOP 1440x900"}  ${url}`);
console.log("overall", total, `scrolled to ${await evaluate("Math.round(scrollY + innerHeight)")} of ${height}px`);
console.table(Object.fromEntries(Object.entries(bySection).sort((a, b) => (sections.findIndex((s) => s.name === a[0]) - sections.findIndex((s) => s.name === b[0]))).filter(([, v]) => v.length > 10).map(([k, v]) => [k, fps(v)])));

const hitches = frames.filter((f) => f[0] > 100);
if (hitches.length) console.log("hitches:", hitches.map((f) => `${f[0].toFixed(0)}ms @${Math.round(f[1])}px (${sectionAt(f[1])})`).join(", "));

// Long animation frames grouped by script.
const byScript = {};
for (const l of loaf) for (const s of l.scripts) {
  const k = `${s.inv} ${s.src}`.slice(0, 90);
  byScript[k] = (byScript[k] ?? 0) + s.d;
}
const topScripts = Object.entries(byScript).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`long animation frames: ${loaf.length}, total blocking ${loaf.reduce((a, l) => a + l.blocking, 0).toFixed(0)}ms`);
for (const [k, d] of topScripts) console.log(`  ${d.toFixed(0).padStart(6)}ms  ${k}`);

if (profileNodes) {
  const self = new Map();
  const dt = profileNodes.timeDeltas;
  const idx = new Map(profileNodes.nodes.map((n) => [n.id, n]));
  profileNodes.samples.forEach((id, i) => {
    const n = idx.get(id);
    const cf = n.callFrame;
    const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const totalMs = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(`\nCPU self time (top 15 of ${totalMs.toFixed(0)}ms):`);
  [...self.entries()].filter(([k]) => !k.startsWith("(idle)") && !k.startsWith("(program)")).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(6)}ms  ${k}`));
  console.log(`  idle ${(self.get([...self.keys()].find((k) => k.startsWith("(idle)"))) ?? 0).toFixed(0)}ms`);
}
if (console_.length) console.log("console errors:", console_.slice(0, 5));

await fetch(`http://localhost:${port}/json/close/${target.id}`);
ws.close();

const pass = total.p95 <= P95_BUDGET && total.jank <= JANK_BUDGET;
console.log(pass ? `\nPASS (p95 ${total.p95}ms <= ${P95_BUDGET}, jank ${total.jank}% <= ${JANK_BUDGET}%)` : `\nFAIL (p95 ${total.p95}ms budget ${P95_BUDGET}, jank ${total.jank}% budget ${JANK_BUDGET}%)`);
process.exit(pass ? 0 : 1);
