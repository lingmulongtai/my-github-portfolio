import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = readFileSync(new URL('../assets/sketch-motion.js', import.meta.url), 'utf8');

test('motion libraries are pinned and load before the motion layer', () => {
  const sources = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
  const layer = sources.indexOf('./assets/sketch-motion.js');
  assert.ok(layer > 0);
  for (const library of ['gsap.min.js', 'ScrollTrigger.min.js', 'Flip.min.js', 'lenis.min.js']) {
    const index = sources.findIndex(source => source.endsWith('/' + library));
    assert.ok(index >= 0 && index < layer, library);
    assert.match(sources[index], /@\d+\.\d+\.\d+\//);
  }
});

test('dialogs keep native scrolling while smooth scrolling is active', () => {
  assert.match(html, /<dialog id="sheet"[^>]*data-lenis-prevent/);
  assert.match(html, /<dialog id="pal"[^>]*data-lenis-prevent/);
});

test('cards carry stable ids so filtering can animate them', () => {
  assert.match(html, /class="launch-card" data-flip-id="site-\$\{esc\(p\.slug\)\}"/);
  assert.match(html, /data-flip-id="\$\{esc\(p\.slug\)\}"/);
  assert.match(html, /class="project-group" data-flip-id="group-\$\{esc\(group\.id\)\}"/);
});

test('the page still works when the motion libraries are unavailable', () => {
  assert.doesNotThrow(() => new Script(code).runInContext(createContext({ window: {}, document: {} })));
});

test('reduced motion skips smooth scrolling and entrances', () => {
  const added = [];
  const gsap = {
    registerPlugin() {},
    matchMedia: () => ({ add: (query, setup) => added.push({ query, setup }) }),
  };
  const document = { documentElement: { dataset: {} }, addEventListener() {} };
  new Script(code).runInContext(createContext({
    window: { gsap, ScrollTrigger: {}, Flip: {}, Lenis: class {} }, document,
    matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} },
  }));
  assert.deepEqual(added.map(entry => entry.query), ['(prefers-reduced-motion: no-preference)']);
});
