#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://nav.al/rich";
const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "demo",
  "input",
  "nav-rich.md"
);

const response = await fetch(SOURCE_URL, {
  headers: {
    "user-agent": "ThoughtLine demo source fetcher",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`);
}

const html = await response.text();
const title =
  decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ||
  "How to Get Rich";
const articleHtml =
  html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html;
const text = decodeEntities(
  articleHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .join("\n\n");

const markdown = `---
title: "${escapeYaml(title)}"
url: "${SOURCE_URL}"
fetchedAt: "${new Date().toISOString()}"
suggestedSourceLabel: "nav.al/rich"
---

# ${title}

${text}
`;

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, markdown, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function escapeYaml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
