import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

const code = readFileSync(new URL("../assets/hero-motion.js", import.meta.url), "utf8");

function setup({ reduced = false, savedPause = null, storageBlocked = false } = {}) {
  function target(extra = {}) {
    const listeners = new Map();
    return { ...extra,
      addEventListener: (name, listener) => listeners.set(name, listener),
      fire: name => listeners.get(name)?.(),
    };
  }
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  let draws = 0, nextFrame = 0;
  const frames = new Map(), observers = [], intersections = [], stored = new Map();
  const context = { setTransform() {}, clearRect() { draws++; }, save() {}, restore() {}, translate() {}, rotate() {},
    scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, arc() {}, fillRect() {}, drawImage() {},
    createRadialGradient: () => ({ addColorStop() {} }) };
  const canvas = { getContext: () => context, getBoundingClientRect: () => rect(0, 0, 1600, 900) };
  const portrait = { getBoundingClientRect: () => rect(1000, 200, 500, 500) };
  const copy = { getBoundingClientRect: () => rect(40, 220, 850, 350) };
  const hero = { querySelector: selector => selector.includes("img") ? portrait : copy };
  const toggle = target({ hidden: true });
  const classes = new Set();
  const document = target({ hidden: false, documentElement: { lang: "ja" },
    body: { classList: { contains: name => classes.has(name) } },
    getElementById: id => ({ home: hero, heroCanvas: canvas, heroMotionToggle: toggle })[id],
    createElement: () => ({ getContext: () => context }) });
  const preference = target({ matches: reduced });
  new Script(code).runInContext(createContext({
    document, matchMedia: () => preference, devicePixelRatio: 2, addEventListener() {},
    localStorage: {
      getItem() { if (storageBlocked) throw new Error("unavailable"); return savedPause; },
      setItem(key, value) { if (storageBlocked) throw new Error("unavailable"); stored.set(key, value); },
    },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} },
    IntersectionObserver: class { constructor(callback) { intersections.push(callback); } observe() {} },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element) { observers.push({ element, callback: this.callback }); }
    },
  }));
  return { document, toggle, preference, stored, canvas, frames, get draws() { return draws; },
    visible(value) { intersections[0]([{ isIntersecting: value }]); },
    locked(value) {
      if (value) classes.add("locked"); else classes.delete("locked");
      observers.filter(observer => observer.element === document.body).forEach(observer => observer.callback());
    },
    language(value) {
      document.documentElement.lang = value;
      observers.filter(observer => observer.element === document.documentElement).forEach(observer => observer.callback());
    },
    tick(now) {
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));
    },
  };
}

test("reduced motion keeps the artwork static, including when the preference changes", () => {
  const ui = setup({ reduced: true });
  ui.visible(true);
  assert.ok(ui.draws > 0);
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.toggle.hidden, true);
  ui.preference.matches = false; ui.preference.fire("change");
  assert.equal(ui.frames.size, 1);
  assert.equal(ui.toggle.hidden, false);
  ui.preference.matches = true; ui.preference.fire("change");
  assert.equal(ui.frames.size, 0);
});

test("the user's pause survives automatic visibility changes and a later visit", () => {
  const ui = setup();
  ui.visible(true); ui.toggle.fire("click");
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.stored.get("portfolio.hero-motion-paused"), "true");
  ui.visible(false); ui.visible(true);
  assert.equal(ui.frames.size, 0);
  const revisit = setup({ savedPause: "true" }); revisit.visible(true);
  assert.equal(revisit.frames.size, 0);
  assert.match(revisit.toggle.textContent, /再生/);
  ui.toggle.fire("click");
  assert.equal(ui.frames.size, 1);
  assert.equal(ui.stored.get("portfolio.hero-motion-paused"), "false");
});

test("offscreen, hidden-tab and modal states suspend work without creating duplicate loops", () => {
  const ui = setup();
  assert.equal(ui.frames.size, 0);
  ui.visible(true); ui.visible(true);
  assert.equal(ui.frames.size, 1);
  ui.visible(false);
  assert.equal(ui.frames.size, 0);
  ui.visible(true); ui.document.hidden = true; ui.document.fire("visibilitychange");
  assert.equal(ui.frames.size, 0);
  ui.document.hidden = false; ui.document.fire("visibilitychange");
  assert.equal(ui.frames.size, 1);
  ui.locked(true);
  assert.equal(ui.frames.size, 0);
  ui.locked(false); ui.tick(100);
  assert.equal(ui.frames.size, 1);
  const painted = ui.draws;
  ui.tick(116);
  assert.equal(ui.draws, painted);
  ui.tick(134);
  assert.equal(ui.draws, painted + 1);
});

test("motion controls work without storage and follow the chosen language", () => {
  const ui = setup({ storageBlocked: true });
  ui.visible(true); ui.language("en");
  assert.equal(ui.toggle.textContent, "Pause background");
  ui.toggle.fire("click");
  assert.equal(ui.toggle.textContent, "Play background");
  assert.equal(ui.frames.size, 0);
  ui.language("ja");
  assert.equal(ui.toggle.textContent, "背景の動きを再生");
});
