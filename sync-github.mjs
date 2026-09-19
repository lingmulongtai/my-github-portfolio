#!/usr/bin/env node
/**
 * projects.json に書かれた repo を GitHub API で引いて data/github.json に保存する。
 * GitHub Actions から毎日実行される想定。ローカルでも `node scripts/sync-github.mjs` で動く。
 *
 * 取得するもの:
 *   stars / forks / language / license / 最終push / リポジトリURL
 *   website  … repo の Website 欄（homepage）。空なら GitHub Pages の URL を推定
 *   weeks    … 直近53週のコミット数（日別）。ヒートマップとグラフに使う
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "portfolio-sync",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, { retries = 6 } = {}) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(API + path, { headers });
    // commit_activity は初回アクセス時に 202 を返して集計を始める
    if (res.status === 202) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (res.status === 404) return null;
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
      const wait = Math.max(3000, reset - Date.now());
      if (wait > 120000) throw new Error(`rate limited for ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }
  return null;
}

const data = JSON.parse(await readFile("projects.json", "utf8"));
const login = data.profile.github;
const out = {};

for (const p of data.projects) {
  if (!p.repo) continue;
  try {
    const repo = await get(`/repos/${p.repo}`);
    if (!repo) {
      console.warn(`skip (not found): ${p.repo}`);
      continue;
    }
    const activity = (await get(`/repos/${p.repo}/stats/commit_activity`)) || [];
    const weeks = Array.isArray(activity)
      ? activity.map((w) => ({ days: w.days, total: w.total }))
      : [];

    out[p.slug] = {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      license: repo.license?.spdx_id || "—",
      pushed: (repo.pushed_at || "").slice(0, 10),
      url: repo.html_url,
      site:
        (repo.homepage && repo.homepage.trim()) ||
        (repo.has_pages ? `https://${login}.github.io/${repo.name}/` : ""),
      topics: repo.topics || [],
      weeks,
    };
    console.log(`ok ${p.repo} — ★${repo.stargazers_count} / ${weeks.length}w`);
  } catch (e) {
    console.warn(`fail ${p.repo}: ${e.message}`);
  }
}

await mkdir("data", { recursive: true });
await writeFile(
  "data/github.json",
  JSON.stringify(out, null, 2) + "\n",
  "utf8"
);
console.log(`\nwrote data/github.json (${Object.keys(out).length} repos)`);
