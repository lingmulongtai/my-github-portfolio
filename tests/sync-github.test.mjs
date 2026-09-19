import test from "node:test";
import assert from "node:assert/strict";
import { collectPortfolio, listPublicRepositories, projectFromRepository, websiteUrl } from "../scripts/sync-github.mjs";

const repo = (name, fields = {}) => ({
  name, full_name: `owner/${name}`, owner: { login: "owner" }, private: false,
  created_at: "2026-01-01T00:00:00Z", pushed_at: "2026-09-19T00:00:00Z",
  html_url: `https://github.com/owner/${name}`, language: "JavaScript",
  stargazers_count: 0, forks_count: 0, ...fields,
});

test("discovers every page, including forks and the profile repository", async () => {
  const first = Array.from({ length: 100 }, (_, i) => repo(`project-${i}`));
  const second = [repo("owner"), repo("fork", { fork: true }), repo("private", { private: true }),
    repo("foreign", { owner: { login: "someone-else" } })];
  const calls = [];
  const repos = await listPublicRepositories("OWNER", async path => {
    calls.push(path);
    return path.endsWith("page=1") ? first : second;
  });
  assert.equal(repos.length, 102);
  assert.equal(calls.length, 2);
  assert.ok(repos.some(r => r.name === "owner"));
  assert.ok(repos.some(r => r.fork));
  assert.ok(repos.every(r => !r.private && r.owner.login === "owner"));
});

test("an incomplete repository list fails instead of publishing a partial catalog", async () => {
  await assert.rejects(listPublicRepositories("owner", async path => path.endsWith("page=1")
    ? Array.from({ length: 100 }, (_, i) => repo(`project-${i}`)) : null), /complete public repository list/);
  await assert.rejects(listPublicRepositories("owner", async () => []), /No public repositories/);
});

test("new projects remain visible when statistics are pending or unavailable", async () => {
  const repos = [repo("new-project"), repo("featured"), repo("fork", { fork: true })];
  const snapshot = await collectPortfolio("owner", [
    { repo: "OWNER/FEATURED", summary: { ja: "紹介", en: "Featured" } },
    { repo: "owner/deleted-project" },
  ], async path => {
    if (path.startsWith("/users/")) return repos;
    if (path.includes("new-project")) throw new Error("Statistics unavailable");
    return null;
  });
  assert.deepEqual(snapshot.projects.map(p => p.repo), ["owner/featured", "owner/fork", "owner/new-project"]);
  assert.equal(snapshot.projects[0].summary.ja, "紹介");
  assert.equal(snapshot.projects[1].status.en, "Fork");
  assert.equal(snapshot.stats["new-project"].url, "https://github.com/owner/new-project");
  assert.deepEqual(snapshot.stats["new-project"].weeks, []);
  assert.equal(snapshot.stats.featured.stars, 0);
  assert.ok(!snapshot.stats["deleted-project"]);
});

test("only safe websites are published, including the root Pages repository", async () => {
  assert.equal(websiteUrl("javascript:alert(1)"), "");
  assert.equal(websiteUrl("data:text/html,test"), "");
  const snapshot = await collectPortfolio("owner", [], async path => path.startsWith("/users/")
    ? [repo("owner.github.io", { has_pages: true, homepage: "javascript:alert(1)" })] : []);
  assert.equal(snapshot.stats["owner.github.io"].site, "https://owner.github.io/");
  assert.equal(projectFromRepository(repo("archived", { archived: true })).status.en, "Archived");
});
