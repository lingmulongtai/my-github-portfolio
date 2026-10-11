#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "portfolio-sync",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

export function commitCountFromPage(page, link = "") {
  if (!Array.isArray(page)) throw new Error("Invalid commit list");
  if (!page.length) return 0;
  const last = link.split(",").find(part => /rel="last"/.test(part));
  if (!last) {
    if (link) throw new Error("Commit pagination is incomplete");
    return page.length;
  }
  const url = new URL(last.match(/<([^>]+)>/)?.[1]);
  const count = Number(url.searchParams.get("page"));
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid commit count");
  return count;
}

async function get(path, { countCommits = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.github.com" + path, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 202) {
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    if (response.status === 409 && countCommits) {
      const error = await response.json();
      if (error.message === "Git Repository is empty.") return 0;
    }
    if (response.status === 404 || response.status === 204) return null;
    if (!response.ok) throw new Error(`${response.status} ${path}`);
    const body = await response.json();
    return countCommits ? commitCountFromPage(body, response.headers.get("link") || "") : body;
  }
  return null;
}

export function websiteUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export async function listPublicRepositories(login, request = get) {
  const repos = new Map();
  for (let page = 1; ; page++) {
    const batch = await request(`/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Could not fetch the complete public repository list.");
    for (const repo of batch) {
      if (repo.private === false && repo.owner?.login.toLowerCase() === login.toLowerCase()) {
        repos.set(repo.full_name.toLowerCase(), repo);
      }
    }
    if (batch.length < 100) break;
  }
  if (!repos.size) throw new Error("No public repositories found; skipping publication.");
  return [...repos.values()];
}

export function projectFromRepository(repo, override = {}) {
  const summary = repo.description || "";
  return {
    slug: repo.name.toLowerCase(),
    repo: repo.full_name,
    name: override.name || repo.name,
    size: override.size || "std",
    filter: override.filter || "other",
    year: (repo.created_at || "").slice(0, 4),
    tag: override.tag || { ja: repo.language || "GitHub", en: repo.language || "GITHUB" },
    status: repo.archived ? { ja: "アーカイブ", en: "Archived" }
      : repo.fork ? { ja: "フォーク", en: "Fork" }
      : { ja: "公開", en: "Public" },
    summary: override.summary || { ja: summary || "GitHubで公開しているプロジェクト", en: summary || "A public project on GitHub" },
    desc: override.desc || { ja: summary || "詳細はリポジトリをご覧ください。", en: summary || "See the repository for details." },
    stack: override.stack || (repo.language ? [repo.language] : []),
    image: override.image || "",
    links: {
      docs: websiteUrl(override.links?.docs),
      site: websiteUrl(override.links?.site),
    },
    fork: Boolean(repo.fork),
  };
}

export async function collectPortfolio(login, overrides = [], request = get) {
  const repos = await listPublicRepositories(login, request);
  const byRepo = new Map(overrides.map((project, index) => [project.repo.toLowerCase(), { project, index }]));
  repos.sort((a, b) => (byRepo.get(a.full_name.toLowerCase())?.index ?? Infinity)
    - (byRepo.get(b.full_name.toLowerCase())?.index ?? Infinity)
    || (b.pushed_at || "").localeCompare(a.pushed_at || "")
    || a.name.localeCompare(b.name));
  const projects = repos.map(repo => projectFromRepository(repo, byRepo.get(repo.full_name.toLowerCase())?.project));
  const stats = {};

  // Statistics may be pending; repository discovery must still include every project.
  for (let offset = 0; offset < repos.length; offset += 4) {
    const entries = await Promise.all(repos.slice(offset, offset + 4).map(async (repo, index) => {
      const project = projects[offset + index];
      const optional = async (path, options) => {
        try { return await request(path, options); }
        catch (error) {
          console.warn(`Metric unavailable for ${repo.full_name}: ${error.message}`);
          return null;
        }
      };
      const [activity, commits, languages] = await Promise.all([
        optional(`/repos/${repo.full_name}/stats/commit_activity`),
        optional(`/repos/${repo.full_name}/commits?per_page=1`, { countCommits: true }),
        optional(`/repos/${repo.full_name}/languages`),
      ]);
      const weeks = Array.isArray(activity) ? activity.map(({ week, days, total }) => ({ week, days, total })) : [];
      const owner = repo.owner.login;
      const pagesUrl = `https://${owner}.github.io/${repo.name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? "" : `${repo.name}/`}`;
      return [project.slug, {
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        languages: languages && !Array.isArray(languages) && typeof languages === "object" ? languages : null,
        commits: Number.isSafeInteger(commits) && commits >= 0 ? commits : null,
        license: repo.license?.spdx_id || "—",
        pushed: (repo.pushed_at || "").slice(0, 10),
        pushedAt: repo.pushed_at || "",
        url: repo.html_url,
        site: project.links.site || websiteUrl(repo.homepage) || (repo.has_pages ? pagesUrl : ""),
        topics: repo.topics || [],
        weeks,
      }];
    }));
    for (const [slug, value] of entries) {
      stats[slug] = value;
      console.log(`ok ${slug} — ${value.weeks.length} weeks`);
    }
  }
  return { owner: login, syncedAt: new Date().toISOString(), projects, stats };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(await readFile("projects.json", "utf8"));
  const snapshot = await collectPortfolio(data.profile.github, data.projects);
  await mkdir("data", { recursive: true });
  await writeFile("data/github.json", JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`Wrote all ${snapshot.projects.length} public repositories to data/github.json`);
}
