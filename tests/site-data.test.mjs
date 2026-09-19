import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const config = JSON.parse(readFileSync(new URL("../projects.json", import.meta.url), "utf8"));
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const loading = code.slice(0, code.indexOf("/* ===================== render"));
const rendering = code.slice(code.indexOf("function render("), code.indexOf("/* ===================== sheet"));

async function boot(snapshot, apiRepos) {
  const nodes = new Map();
  const context = createContext({
    matchMedia: () => ({ matches: true }),
    document: {
      getElementById: id => {
        if (!nodes.has(id)) nodes.set(id, { textContent: id === "site-data" ? JSON.stringify(config) : "",
          innerHTML: "", classList: { toggle() {} } });
        return nodes.get(id);
      },
      querySelectorAll: () => [], documentElement: {},
    },
    fetch: async url => {
      if (url === "./projects.json") return { ok: true, json: async () => structuredClone(config) };
      if (url === "./data/github.json") return { ok: Boolean(snapshot), json: async () => structuredClone(snapshot) };
      return { ok: Boolean(apiRepos), json: async () => structuredClone(apiRepos) };
    },
    localStorage: { getItem: () => "en" }, navigator: { language: "en" },
    URL, AbortSignal, curI: -1, startMotion() {},
  });
  const result = await new Script(loading + rendering + "\nboot().then(() => ({ data: DATA, live: LIVE }))").runInContext(context);
  return { ...result, nodes };
}

test("the page JavaScript parses and fallback project identifiers match", () => {
  new Script(code);
  const fallback = JSON.parse(html.match(/<script type="application\/json" id="site-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(fallback.projects.map(p => p.repo), config.projects.map(p => p.repo));
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
  assert.ok(!cards.includes("<img"));
  assert.match(cards, /&lt;img/);
  assert.match(cards, /&quot;title&quot;/);
  assert.match(result.nodes.get("pulseSum").textContent, /^— commits/);
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
