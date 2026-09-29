import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const code = readFileSync(new URL('../assets/page-motion.js', import.meta.url), 'utf8');
function setup() {
  const target = extra => {
    const events = new Map();
    return { ...extra, addEventListener: (name, callback) => events.set(name, callback),
      fire: (name, event = {}) => events.get(name)?.(event) };
  };
  const frames = new Map(), observers = [], intersections = [], classes = new Set();
  let nextFrame = 0;
  const track = { scrollWidth: 3000, style: {}, parentElement: {} };
  const cursor = { style: {}, classList: { toggle() {} } };
  const letter = { style: {}, getBoundingClientRect: () => ({ left: 20, top: 20, width: 40, height: 40 }) };
  const document = target({ hidden: false, documentElement: { dataset: {} },
    body: { classList: { contains: name => classes.has(name) } },
    getElementById: id => ({ track, cur: cursor })[id], querySelectorAll: () => [letter] });
  const reduced = target({ matches: false }), fine = target({ matches: false }), window = target({ scrollY: 0 });
  new Script(code).runInContext(createContext({ document, scrollY: 0, matchMedia: query => query.includes('reduced') ? reduced : fine,
    addEventListener: window.addEventListener,
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class { constructor(callback) { intersections.push(callback); } observe() {} },
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe(element) { observers.push({ element, callback: this.callback }); } },
  }));
  const mutate = element => observers.filter(observer => observer.element === element).forEach(observer => observer.callback());
  return { frames, track, cursor, letter, document, reduced, fine, window,
    visible(value) { intersections[0]([{ isIntersecting: value }]); },
    lock(value) { if (value) classes.add('locked'); else classes.delete('locked'); mutate(document.body); },
    pause(value) { document.documentElement.dataset.motionPaused = String(value); mutate(document.documentElement); },
    tick(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); },
  };
}

test('marquee suspends offscreen, hidden, paused, reduced or behind a modal without duplicate loops', () => {
  const ui = setup(); assert.equal(ui.frames.size, 0);
  ui.visible(true); ui.visible(true); assert.equal(ui.frames.size, 1);
  ui.tick(100); ui.tick(134); assert.match(ui.track.style.transform, /translateX\(-/);
  const painted = ui.track.style.transform; ui.tick(145); assert.equal(ui.track.style.transform, painted);
  ui.visible(false); assert.equal(ui.frames.size, 0);
  ui.visible(true); ui.lock(true); assert.equal(ui.frames.size, 0);
  ui.lock(false); ui.pause(true); assert.equal(ui.frames.size, 0);
  ui.pause(false); ui.reduced.matches = true; ui.reduced.fire('change'); assert.equal(ui.frames.size, 0);
  ui.reduced.matches = false; ui.reduced.fire('change'); assert.equal(ui.frames.size, 1);
  ui.document.hidden = true; ui.document.fire('visibilitychange'); assert.equal(ui.frames.size, 0);
  ui.document.hidden = false; ui.document.fire('visibilitychange'); assert.equal(ui.frames.size, 1);
});

test('touch never leaves mouse transforms behind; mouse feedback resets on pointer exit and motion preference changes', () => {
  const ui = setup();
  ui.window.fire('pointermove', { pointerType: 'touch', clientX: 40, clientY: 40 });
  assert.equal(ui.frames.size, 0); assert.equal(ui.cursor.style.opacity, '0');
  ui.fine.matches = true; ui.fine.fire('change');
  ui.window.fire('pointermove', { pointerType: 'touch', clientX: 40, clientY: 40 });
  assert.equal(ui.frames.size, 0);
  ui.window.fire('pointermove', { pointerType: 'mouse', clientX: 40, clientY: 40 }); ui.tick(100);
  assert.match(ui.letter.style.transform, /translateY\(-18px\)/);
  ui.document.fire('pointerout', { relatedTarget: null });
  assert.equal(ui.letter.style.transform, ''); assert.equal(ui.cursor.style.opacity, '0');
  ui.window.fire('pointermove', { pointerType: 'mouse', clientX: 40, clientY: 40 });
  ui.reduced.matches = true; ui.reduced.fire('change');
  assert.equal(ui.frames.size, 0); assert.equal(ui.letter.style.transform, '');
});
