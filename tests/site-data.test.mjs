import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const config = JSON.parse(readFileSync(new URL("../projects.json", import.meta.url), "utf8"));
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const loading = code.slice(0, code.indexOf("/* ===================== render"));
const rendering = code.slice(code.indexOf("function render("), code.indexOf("/* ===================== sheet"));

async function boot(snapshot, apiRepos, { storage = { getItem: () => "en" } } = {}) {
  const nodes = new Map();
  const context = createContext({
    matchMedia: () => ({ matches: true }),
    document: {
      getElementById: id => {
        if (!nodes.has(id)) nodes.set(id, { textContent: id === "site-data" ? JSON.stringify(config) : "",
          innerHTML: "", setAttribute() {}, classList: { toggle() {} } });
        return nodes.get(id);
      },
      querySelectorAll: () => [], documentElement: {},
    },
    fetch: async url => {
      if (url === "./projects.json") return { ok: true, json: async () => structuredClone(config) };
      if (url === "./data/github.json") return { ok: Boolean(snapshot), json: async () => structuredClone(snapshot) };
      return { ok: Boolean(apiRepos), json: async () => structuredClone(apiRepos) };
    },
    localStorage: storage, navigator: { language: "en" },
    URL, AbortSignal, Intl, curI: -1, startMotion() {},
  });
  const result = await new Script(loading + rendering + "\nboot().then(() => ({ data: DATA, live: LIVE }))").runInContext(context);
  return { ...result, nodes, context };
}

test("the page JavaScript parses and fallback project identifiers match", () => {
  new Script(code);
  const fallback = JSON.parse(html.match(/<script type="application\/json" id="site-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(fallback, config);
  assert.equal(new Set(config.projects.map(p => p.slug)).size, config.projects.length);
});

test("the generated catalog controls membership and escapes remote descriptions", async () => {
  const project = { ...config.projects[0], slug: "new-project", name: 'New <project> "title"',
    summary: { en: '<img src=x onerror="alert(1)">' } };
  const result = await boot({ owner: config.profile.github, projects: [project], stats: { "new-project": {
    stars: 0, weeks: [], site: "javascript:alert(1)", url: "https://github.com/owner/new-project",
  } } });
  assert.equal(result.data.projects.length, 1);
  assert.equal(result.data.projects[0].g.commits, null);
  assert.equal(result.data.projects[0].g.site, "");
  const cards = result.nodes.get("bento").innerHTML;
  assert.ok(!cards.includes("<img src=x"));
  assert.match(cards, /&lt;img/);
  assert.match(cards, /&quot;title&quot;/);
  assert.match(cards, /class="tile-art"/);
  assert.match(cards, /alt="" aria-hidden="true" loading="lazy"/);
  assert.match(result.nodes.get("pulseSum").textContent, /^— commits/);
});

test("project artwork is restricted to local assets", async () => {
  const project = { ...config.projects[0], image: 'https://external.example/tracker.png' };
  const result = await boot({ owner: config.profile.github, projects: [project], stats: {} });
  const cards = result.nodes.get("bento").innerHTML;
  assert.ok(!cards.includes("tile-art"));
  assert.ok(!cards.includes("external.example"));
});

test("offline mode preserves real project descriptions without invented statistics", async () => {
  const result = await boot(null);
  assert.equal(result.live, false);
  assert.equal(result.data.projects.length, config.projects.length);
  assert.ok(result.data.projects.every(p => p.g.commits === null && p.g.weeks.length === 0));
  assert.match(result.nodes.get("srcBadge").textContent, /UNAVAILABLE/);
  assert.ok(!result.nodes.get("bento").innerHTML.includes("DEMO DATA"));
});

test("browser API fallback discovers a newly added owned public repository", async () => {
  const account = config.profile.github;
  const repo = { name: "brand-new", full_name: `${account}/brand-new`, owner: { login: account }, private: false,
    created_at: "2026-09-19T00:00:00Z", pushed_at: "2026-09-19T00:00:00Z", description: "New repository",
    html_url: `https://github.com/${account}/brand-new`, stargazers_count: 0, forks_count: 0 };
  const result = await boot(null, [repo, { ...repo, name: "private", private: true }]);
  assert.equal(result.live, true);
  assert.equal(result.data.projects.length, 1);
  assert.equal(result.data.projects[0].name, "brand-new");
  assert.equal(result.data.projects[0].g.commits, null);
});

test("repositories with unavailable dates are still discovered in the browser", async () => {
  const account = config.profile.github;
  const repos = ["empty-one", "empty-two"].map(name => ({ name, full_name: `${account}/${name}`,
    owner: { login: account }, private: false, created_at: null, pushed_at: null,
    html_url: `https://github.com/${account}/${name}`, stargazers_count: 0, forks_count: 0 }));
  const result = await boot(null, repos);
  assert.equal(result.live, true);
  assert.equal(result.data.projects.length, 2);
  assert.ok(result.data.projects.every(p => p.year === "" && p.g.pushed === ""));
});

test("category selection removes unrelated cards and survives a language change", async () => {
  const ui = await boot(null);
  const tiles = ui.data.projects.map(project => ({ dataset: { f: project.filter }, hidden: false }));
  const buttons = ['all', 'mobile'].map(k => ({ dataset: { k }, attributes: {},
    classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; } }));
  ui.context.document.querySelectorAll = selector => selector === '.tile' ? tiles : selector === '.fbtn' ? buttons : [];
  new Script("FILTER='mobile'; applyFilter()").runInContext(ui.context);
  assert.ok(tiles.some(tile => tile.hidden));
  assert.ok(tiles.filter(tile => !tile.hidden).every(tile => tile.dataset.f === 'mobile'));
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  new Script("LANG='ja'; render()").runInContext(ui.context);
  assert.ok(tiles.filter(tile => !tile.hidden).every(tile => tile.dataset.f === 'mobile'));
  assert.match(ui.nodes.get('workCount').textContent, /件を表示/);
  new Script("FILTER='all'; applyFilter()").runInContext(ui.context);
  assert.ok(tiles.every(tile => !tile.hidden));
});

test("all-time counts stay separate from annual activity and language names are prominent and escaped", async () => {
  const project = config.projects[0];
  const ui = await boot({ owner: config.profile.github, syncedAt: new Date().toISOString(), projects: [project], stats: {
    [project.slug]: { commits: 626, language: 'JavaScript', languages: { TypeScript: 300, Python: 200, '<script>': 1 },
      weeks: [{ total: 577, days: [577, 0, 0, 0, 0, 0, 0] }] },
  } });
  assert.equal(ui.data.projects[0].g.commits, 626);
  assert.equal(ui.data.projects[0].g.annualCommits, 577);
  assert.match(ui.nodes.get('pulseSum').textContent, /^577 commits/);
  assert.match(ui.nodes.get('figs').innerHTML, /data-to="626"/);
  assert.match(ui.nodes.get('figs').innerHTML, /<i>Python<\/i>/);
  assert.match(ui.nodes.get('figs').innerHTML, /&lt;script&gt;/);
  assert.match(ui.nodes.get('bento').innerHTML, /<i>TypeScript<\/i>/);
  assert.ok(!ui.nodes.get('figs').innerHTML.includes('<script>'));
  assert.match(ui.nodes.get('syncInfo').textContent, /Last synced.*JST/);
});

test("old snapshots are visibly stale while the browser API identifies its limited metrics", async () => {
  const ui = await boot({ owner: config.profile.github, syncedAt: '2020-01-01T00:00:00Z', projects: [config.projects[0]], stats: {} });
  assert.match(ui.nodes.get('srcBadge').textContent, /UPDATE PENDING/);
  assert.match(ui.nodes.get('syncInfo').textContent, /2020/);
  const api = await boot(null, [{ name: 'new', full_name: `${config.profile.github}/new`, private: false,
    owner: { login: config.profile.github }, language: 'Python' }]);
  assert.match(api.nodes.get('syncInfo').textContent, /annual activity and all-time counts unavailable/);
  assert.match(api.nodes.get('figs').innerHTML, /<i>Python<\/i>/);
});

test("sorts handle ties, unknown counts, exact update times, and preserve the original catalog", async () => {
  const projects = ['first', 'second', 'unknown', 'zero'].map(slug => ({ ...config.projects[0], slug, name: slug }));
  const ui = await boot({ owner: config.profile.github, projects, stats: {
    first: { stars: 5, forks: 1, commits: 3, pushedAt: '2026-10-11T02:00:00Z' },
    second: { stars: 5, forks: 2, commits: 7, pushedAt: '2026-10-11T09:00:00Z' },
    unknown: {}, zero: { stars: 0, commits: 0, pushedAt: '2026-10-10T00:00:00Z' },
  } });
  const order = sort => JSON.parse(new Script(`SORT='${sort}'; JSON.stringify(projectOrder().map(({p})=>p.slug))`).runInContext(ui.context));
  assert.deepEqual(order('popular'), ['second', 'first', 'zero', 'unknown']);
  assert.deepEqual(order('commits'), ['second', 'first', 'zero', 'unknown']);
  assert.deepEqual(order('updated'), ['second', 'first', 'zero', 'unknown']);
  assert.deepEqual(order('recommended'), projects.map(p => p.slug));
  new Script("FILTER='web'; setSort('commits'); LANG='ja'; render()").runInContext(ui.context);
  const cards = ui.nodes.get('bento').innerHTML;
  assert.ok(cards.indexOf('data-i="1"') < cards.indexOf('data-i="0"'));
  assert.match(ui.nodes.get('projectSort').innerHTML, /value="commits" selected/);
  assert.deepEqual(ui.data.projects.map(p => p.slug), projects.map(p => p.slug));
});

test("sort selection restores only supported values and works with blocked storage", async () => {
  const saved = await boot(null, null, { storage: { getItem: key => key === 'project-sort' ? 'updated' : 'en' } });
  assert.match(saved.nodes.get('projectSort').innerHTML, /value="updated" selected/);
  const invalid = await boot(null, null, { storage: { getItem: () => 'invalid' } });
  assert.match(invalid.nodes.get('projectSort').innerHTML, /value="recommended" selected/);
  const blocked = await boot(null, null, { storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  new Script("setSort('popular')").runInContext(blocked.context);
  assert.match(blocked.nodes.get('projectSort').innerHTML, /value="popular" selected/);
});
