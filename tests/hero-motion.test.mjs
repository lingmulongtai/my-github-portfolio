import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

const code = readFileSync(new URL("../assets/hero-motion.js", import.meta.url), "utf8");

function setup({ reduced = false, savedPause = null, storageBlocked = false, width = 1600, height = 900 } = {}) {
  function target(extra = {}) {
    const listeners = new Map();
    return { ...extra,
      addEventListener: (name, listener) => listeners.set(name, listener),
      fire: (name, event = {}) => listeners.get(name)?.(event),
    };
  }
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  let draws = 0, nextFrame = 0;
  const frames = new Map(), observers = [], intersections = [], stored = new Map();
  let matrix = [1, 0, 0, 1, 0, 0], bounds;
  const transforms = [];
  function point(x, y) {
    const [a, b, c, d, e, f] = matrix, px = a * x + c * y + e, py = b * x + d * y + f;
    bounds.left = Math.min(bounds.left, px); bounds.right = Math.max(bounds.right, px);
    bounds.top = Math.min(bounds.top, py); bounds.bottom = Math.max(bounds.bottom, py);
  }
  const context = {
    setTransform(...values) { matrix = values; },
    clearRect() { draws++; bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }; },
    save() { transforms.push([...matrix]); }, restore() { matrix = transforms.pop(); },
    translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
    rotate(angle) {
      const [a, b, c, d, e, f] = matrix, co = Math.cos(angle), si = Math.sin(angle);
      matrix = [a * co + c * si, b * co + d * si, c * co - a * si, d * co - b * si, e, f];
    },
    scale(x, y) { matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y; },
    beginPath() {}, moveTo: point, lineTo: point, closePath() {}, fill() {},
    arc(x, y, radius) {
      for (let i = 0; i < 16; i++) point(x + radius * Math.cos(i * Math.PI / 8), y + radius * Math.sin(i * Math.PI / 8));
    },
  };
  const canvas = { getContext: () => context, getBoundingClientRect: () => rect(0, 0, width, height) };
  const portrait = { getBoundingClientRect: () => rect(1000, 200, 500, 500) };
  const copy = { getBoundingClientRect: () => rect(40, 220, 850, 350) };
  const hero = target({ querySelector: selector => selector.includes("img") ? portrait : copy });
  const toggle = target({ hidden: true });
  const touchHint = { hidden: true };
  const classes = new Set();
  const document = target({ hidden: false, documentElement: { lang: "ja", dataset: {} },
    body: { classList: { contains: name => classes.has(name) } },
    getElementById: id => ({ home: hero, heroCanvas: canvas, heroMotionToggle: toggle, touchHint })[id],
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
  return { document, toggle, touchHint, hero, preference, stored, canvas, frames, get draws() { return draws; },
    get bounds() { return bounds; },
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

test("the complete animated composition and edge-tap feedback stay inside the canvas", () => {
  for (const [width, height] of [[240, 240], [390, 390], [600, 600], [1600, 900], [320, 600]]) {
    const ui = setup({ width, height }); ui.visible(true);
    const contained = () => {
      assert.ok(ui.bounds.left > 0 && ui.bounds.top > 0, JSON.stringify(ui.bounds));
      assert.ok(ui.bounds.right < width * 1.5 && ui.bounds.bottom < height * 1.5, JSON.stringify(ui.bounds));
    };
    contained();
    for (const [clientX, clientY] of [[0, 0], [width, height], [0, height], [width, 0]]) {
      ui.hero.fire('pointerdown', touch({ clientX, clientY }));
      ui.hero.fire('pointerup', touch({ clientX, clientY, timeStamp: 200 }));
      for (let i = 0; i < 45; i++) { ui.tick(1000 + i * 50); contained(); }
    }
  }
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

const touch = (extra = {}) => ({ pointerType: 'touch', pointerId: 1, isPrimary: true,
  clientX: 1250, clientY: 450, timeStamp: 100, target: { closest: () => null }, ...extra });

test("a brief touch nudges the artwork, while scrolls, cancellations, controls and long presses do not", () => {
  const ui = setup(); ui.visible(true);
  const before = ui.draws;
  ui.hero.fire('pointerdown', touch());
  ui.hero.fire('pointerup', touch({ timeStamp: 200 }));
  assert.equal(ui.draws, before + 1);
  for (const sequence of [
    [['pointerdown', {}], ['pointermove', { clientY: 500 }], ['pointerup', {}]],
    [['pointerdown', {}], ['pointercancel', {}], ['pointerup', {}]],
    [['pointerdown', {}], ['pointerup', { timeStamp: 800 }]],
    [['pointerdown', {}], ['pointerup', { clientY: 500 }]],
    [['pointerdown', { pointerType: 'mouse' }], ['pointerup', {}]],
    [['pointerdown', { target: { closest: () => ({}) } }], ['pointerup', {}]],
    [['pointerdown', {}], ['pointerdown', { isPrimary: false, pointerId: 2 }], ['pointerup', {}]],
  ]) {
    const draws = ui.draws;
    sequence.forEach(([name, event]) => ui.hero.fire(name, touch(event)));
    assert.equal(ui.draws, draws);
  }
});

test("touch feedback respects pause and reduced motion and shares the pause preference with page effects", () => {
  const ui = setup(); ui.visible(true);
  assert.equal(ui.touchHint.hidden, false);
  ui.toggle.fire('click');
  assert.equal(ui.touchHint.hidden, true);
  assert.equal(ui.document.documentElement.dataset.motionPaused, 'true');
  const draws = ui.draws;
  ui.hero.fire('pointerdown', touch()); ui.hero.fire('pointerup', touch());
  assert.equal(ui.draws, draws);
  ui.toggle.fire('click');
  ui.preference.matches = true; ui.preference.fire('change');
  assert.equal(ui.touchHint.hidden, true);
  ui.hero.fire('pointerdown', touch()); ui.hero.fire('pointerup', touch());
  assert.equal(ui.draws, draws);
});
