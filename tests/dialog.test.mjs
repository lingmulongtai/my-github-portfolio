import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const interactions = code.slice(code.indexOf("const sheet=$("), code.indexOf("/* ===================== motion"));
const config = JSON.parse(readFileSync(new URL("../projects.json", import.meta.url), "utf8"));

function setup() {
  const nodes = new Map(), routes = [], events = new Map(), scrolls = [], remembered = [];
  const document = { activeElement: null, addEventListener() {}, querySelectorAll: () => [] };
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const classes = new Set(), handlers = new Map();
    const element = {
      id, open: false, value: "", textContent: "", innerHTML: "", scrollTop: 0, style: {},
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, on = !classes.has(name)) { if (on) classes.add(name); else classes.delete(name); },
      },
      focus() { document.activeElement = this; },
      showModal() { assert.equal(this.open, false); this.opener = document.activeElement; this.open = true; },
      close() { this.open = false; document.activeElement = this.opener; },
      addEventListener(name, handler) { handlers.set(name, handler); },
      fire(name, event = {}) { handlers.get(name)?.({ preventDefault() {}, ...event }); },
      querySelectorAll() { return this.controls || []; },
      getClientRects: () => [{}],
      scrollIntoView() {},
      getBoundingClientRect: () => ({ left: 100, top: 100, right: 600, bottom: 700 }),
    };
    nodes.set(id, element);
    return element;
  }
  document.body = node("body");
  document.activeElement = node("project-launcher");
  const context = createContext({
    $: node, document, location: { hash: "", pathname: "/portfolio/" },
    history: { state: null, scrollRestoration: 'auto',
      pushState: (state, title, route) => routes.push(route),
      replaceState: state => remembered.push(state) },
    addEventListener: (name, handler) => events.set(name, handler),
    scrollY: 720, scrollTo: position => scrolls.push(position.top),
    DATA: { profile: config.profile, projects: config.projects.slice(0, 2).map(project => ({
      ...project, g: { bars: [1], weeks: [], pushed: "", site: "", url: project.repo },
    })) },
    tx: value => typeof value === "string" ? value : value?.en || "",
    t: key => key, esc: value => String(value ?? ""), webUrl: () => "", render() {},
  });
  const api = new Script(interactions + "\n({ open, close, palOpen, palClose })").runInContext(context);
  return { ...api, node, document, routes, events, context, scrolls, remembered };
}

test("project navigation restores the original launcher when the modal closes", () => {
  const ui = setup(), launcher = ui.document.activeElement;
  ui.open(0);
  assert.equal(ui.node("sheet").open, true);
  assert.equal(ui.document.activeElement, ui.node("sClose"));
  ui.node("sNext").fire("click");
  assert.equal(ui.node("sTitle").textContent, config.projects[1].name);
  ui.node("sClose").fire("click");
  assert.equal(ui.node("sheet").open, false);
  assert.equal(ui.document.activeElement, launcher);
  assert.equal(ui.document.body.classList.contains("locked"), false);
  assert.equal(ui.routes.at(-1), "/portfolio/");
});

test("native Escape cancellation closes the modal and clears the project route", () => {
  const ui = setup();
  ui.open(0);
  let cancelled = false;
  ui.node("sheet").fire("cancel", { preventDefault() { cancelled = true; } });
  assert.equal(cancelled, true);
  assert.equal(ui.node("sheet").open, false);
  assert.equal(ui.routes.at(-1), "/portfolio/");
});

test("only clicks outside the dialog card dismiss it", () => {
  const ui = setup(), sheet = ui.node("sheet");
  ui.open(0);
  sheet.fire("click", { target: sheet, clientX: 300, clientY: 300 });
  assert.equal(sheet.open, true);
  sheet.fire("click", { target: ui.node("sTitle"), clientX: 300, clientY: 300 });
  assert.equal(sheet.open, true);
  sheet.fire("click", { target: sheet, clientX: 20, clientY: 300 });
  assert.equal(sheet.open, false);
});

test("closing search over a project keeps the underlying modal and page lock", () => {
  const ui = setup();
  ui.open(0);
  ui.palOpen();
  assert.equal(ui.node("pal").open, true);
  ui.node("pal").fire("cancel");
  assert.equal(ui.node("pal").open, false);
  assert.equal(ui.node("sheet").open, true);
  assert.equal(ui.document.body.classList.contains("locked"), true);
  ui.close();
  assert.equal(ui.document.body.classList.contains("locked"), false);
});

test("deep-link and browser history changes do not add extra history entries", () => {
  const ui = setup();
  ui.open(0, false);
  assert.deepEqual(ui.routes, []);
  ui.context.location.hash = "#" + config.projects[1].slug;
  ui.events.get("popstate")();
  assert.equal(ui.node("sTitle").textContent, config.projects[1].name);
  ui.context.location.hash = "#work";
  ui.events.get("popstate")();
  assert.equal(ui.node("sheet").open, false);
  assert.deepEqual(ui.routes, []);
});

test("Enter selects a search result without activating the newly focused close button", () => {
  const ui = setup();
  ui.palOpen();
  let prevented = false;
  ui.node("palin").fire("keydown", { key: "Enter", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ui.node("pal").open, false);
  assert.equal(ui.node("sheet").open, true);
  assert.equal(ui.node("sTitle").textContent, config.projects[0].name);
});

test("Tab and Shift+Tab wrap inside the topmost dialog", () => {
  const ui = setup(), first = ui.node("sPrev"), last = ui.node("repo-link");
  ui.open(0);
  ui.node("sheet").controls = [first, last];
  last.focus();
  let prevented = false;
  ui.events.get("keydown")({ key: "Tab", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ui.document.activeElement, first);
  ui.events.get("keydown")({ key: "Tab", shiftKey: true, preventDefault() {} });
  assert.equal(ui.document.activeElement, last);
  ui.palOpen();
  const input = ui.node("palin"), result = ui.node("search-result");
  ui.node("pal").controls = [input, result];
  result.focus();
  ui.events.get("keydown")({ key: "Tab", preventDefault() {} });
  assert.equal(ui.document.activeElement, input);
});

test("browser Back from Search leaves only the restored project modal open", () => {
  const ui = setup();
  ui.open(0);
  ui.close();
  ui.palOpen();
  ui.context.location.hash = "#" + config.projects[0].slug;
  const routeCount = ui.routes.length;
  ui.events.get("popstate")();
  assert.equal(ui.node("pal").open, false);
  assert.equal(ui.node("sheet").open, true);
  assert.equal(ui.document.activeElement, ui.node("sClose"));
  assert.equal(ui.routes.length, routeCount);
  ui.events.get("keydown")({ key: "ArrowRight" });
  assert.equal(ui.node("sTitle").textContent, config.projects[1].name);
  ui.close();
  assert.equal(ui.document.body.classList.contains("locked"), false);
});

test("the visible search close button restores the original page position", () => {
  const ui = setup();
  ui.palOpen();
  assert.equal(ui.document.body.style.top, '-720px');
  ui.context.scrollY = 0;
  ui.node('palClose').fire('click');
  assert.equal(ui.node('pal').open, false);
  assert.equal(ui.document.body.style.top, '');
  assert.deepEqual(ui.scrolls, [720]);
});

test("search-to-project handoff and nested search keep the page locked until the last dialog closes", () => {
  const ui = setup();
  ui.palOpen();
  ui.context.scrollY = 0;
  ui.node('palin').fire('keydown', { key: 'Enter' });
  assert.deepEqual(ui.scrolls, []);
  assert.equal(ui.document.body.style.top, '-720px');
  ui.palOpen(); ui.palClose();
  assert.deepEqual(ui.scrolls, []);
  ui.close();
  assert.deepEqual(ui.scrolls, [720]);
});

test("IME confirmation does not open a project before the search query is committed", () => {
  const ui = setup(); ui.palOpen();
  for (const event of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) {
    ui.node('palin').fire('keydown', event);
    assert.equal(ui.node('pal').open, true);
    assert.equal(ui.node('sheet').open, false);
  }
  ui.node('palin').fire('keydown', { key: 'Enter' });
  assert.equal(ui.node('sheet').open, true);
});

test("Back restores the saved list position without native restoration competing with the modal", () => {
  const ui = setup(); ui.open(0);
  assert.equal(ui.context.history.scrollRestoration, 'manual');
  assert.equal(ui.remembered[0].pageY, 720);
  ui.context.scrollY = 0;
  ui.context.location.hash = '#work';
  ui.events.get('popstate')({ state: ui.remembered[0] });
  assert.equal(ui.node('sheet').open, false);
  assert.equal(ui.scrolls.at(-1), 720);
  const visits = ui.remembered.length;
  ui.context.location.hash = '#' + config.projects[0].slug;
  ui.events.get('popstate')({ state: { i: 0 } });
  assert.equal(ui.node('sheet').open, true);
  assert.equal(ui.remembered.length, visits);
});
