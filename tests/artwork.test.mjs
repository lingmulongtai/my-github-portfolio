import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../projects.json", import.meta.url), "utf8"));
const prompts = JSON.parse(readFileSync(new URL("../assets/projects/prompts.json", import.meta.url), "utf8"));

test("every curated project has its own optimized generated artwork and prompt", () => {
  assert.equal(new Set(config.projects.map(project => project.image)).size, config.projects.length);
  for (const project of config.projects) {
    assert.match(project.image, /^assets\/projects\/[a-z0-9-]+\.webp$/);
    const image = readFileSync(new URL("../" + project.image, import.meta.url));
    assert.equal(image.toString("ascii", 0, 4), "RIFF");
    assert.equal(image.toString("ascii", 8, 12), "WEBP");
    assert.ok(image.length < 250_000, `${project.slug} should stay below 250 KB`);
    assert.equal(prompts.images.find(prompt => prompt.slug === project.slug)?.path, project.image);
  }
});
