#!/usr/bin/env node
/**
 * Checks the shape of the Mintlify site: docs.json and the MDX tree agree both
 * ways, every link and image resolves, and page frontmatter is complete.
 *
 *   - docs.json parses
 *   - every navigation page, group root, anchor/navbar/footer href and redirect
 *     destination resolves to an MDX page; every API operation in navigation
 *     exists in api-reference/openapi.json
 *   - every .mdx outside snippets/ is in navigation
 *   - titles are unique; description is present and 160 characters or fewer;
 *     icon is present
 *   - internal links and image paths in pages resolve; no page links to a
 *     redirect source (link the destination instead)
 *   - redirect sources do not shadow a page
 *
 * Usage: node scripts/check-docs-site.mjs
 * Set OPENTYPE_DOCS_ROOT to check another tree (the fixture tests do).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, collectNav, files, frontmatter, operationOf, pageSlugs, readJson, readText, report,
} from './lib.mjs';

const failures = [];
const fail = (message) => failures.push(message);

const slugs = new Set(pageSlugs());
const clean = (href) => href.split('#')[0].split('?')[0].replace(/^\//, '').replace(/\/$/, '');

/** "" is the site root (index.mdx); "guides" may be guides/index.mdx. */
function resolvePage(href) {
  const slug = clean(href);
  if (slug === '') return slugs.has('index') ? 'index' : null;
  if (slugs.has(slug)) return slug;
  if (slugs.has(`${slug}/index`)) return `${slug}/index`;
  return null;
}

const isInternal = (href) => typeof href === 'string' && href.startsWith('/');

const docs = readJson('docs.json', fail);
const spec = readJson('api-reference/openapi.json', fail);
const specPaths = Object.keys(spec?.paths ?? {});

// Pages Mintlify generates from the OpenAPI spec, addressed by their x-mint href.
const generated = new Set();
for (const rel of files().filter((f) => f.startsWith('api-reference/') && f.endsWith('.json'))) {
  for (const m of readText(rel).matchAll(/"x-mint"\s*:\s*\{[^}]*?"href"\s*:\s*"([^"]+)"/g)) {
    generated.add(clean(m[1]));
  }
}

const redirectSources = new Set();

if (docs !== null) {
  const nav = collectNav(docs.navigation);
  const inNav = new Set();
  for (const page of nav.pages) {
    const slug = resolvePage(`/${page}`);
    if (slug === null) fail(`docs.json navigation lists ${page}, which has no ${page}.mdx`);
    else if (inNav.has(slug)) fail(`docs.json navigation lists ${page} twice`);
    else inNav.add(slug);
  }
  for (const entry of nav.operations) {
    const op = operationOf(entry);
    const template = specPaths.find((p) => p === op.path);
    if (template === undefined || spec.paths[template][op.method] === undefined) {
      fail(`docs.json navigation lists "${entry}", which is not in api-reference/openapi.json`);
    }
  }

  const extra = collectNav([docs.navbar?.links, docs.navbar?.primary, docs.footer?.links]);
  for (const href of [...nav.hrefs, ...extra.hrefs, docs.logo?.href].filter(isInternal)) {
    if (resolvePage(href) === null) fail(`docs.json links to ${href}, which has no page`);
  }
  for (const asset of [docs.favicon, docs.logo?.light, docs.logo?.dark]) {
    if (typeof asset !== 'string') fail('docs.json must set favicon, logo.light and logo.dark');
    else if (!existsSync(join(ROOT, asset))) fail(`docs.json asset ${asset} does not exist`);
  }

  for (const { source, destination } of docs.redirects ?? []) {
    if (typeof source !== 'string' || typeof destination !== 'string') {
      fail('docs.json has a redirect without source or destination');
      continue;
    }
    if (/[:*]/.test(source)) continue; // Wildcard sources match no single page.
    redirectSources.add(clean(source));
    const shadowed = resolvePage(source);
    if (shadowed !== null) fail(`redirect source ${source} collides with the page ${shadowed}.mdx`);
    if (isInternal(destination) && resolvePage(destination) === null) {
      fail(`redirect ${source} -> ${destination}: the destination has no page`);
    }
  }

  for (const slug of slugs) {
    if (!inNav.has(slug)) fail(`${slug}.mdx is not in docs.json navigation`);
  }
}

const titles = new Map();
for (const slug of [...slugs].sort()) {
  const rel = `${slug}.mdx`;
  const text = readText(rel);
  const parsed = frontmatter(text);
  if (parsed === null) {
    fail(`${rel} has no frontmatter`);
    continue;
  }
  const { fm, body } = parsed;
  if (!fm.title) fail(`${rel} has no title`);
  else if (titles.has(fm.title)) fail(`${rel} repeats the title "${fm.title}" of ${titles.get(fm.title)}`);
  else titles.set(fm.title, rel);
  if (!fm.description) fail(`${rel} has no description`);
  else if (fm.description.length > 160) {
    fail(`${rel} description is ${fm.description.length} characters (max 160)`);
  }
  if (!fm.icon) fail(`${rel} has no icon`);

  const prose = body.replace(/```[\s\S]*?```/g, '');
  for (const m of prose.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)|\bsrc=["'{`]*([^"'}`\s>]+)/g)) {
    const src = m[1] ?? m[2];
    if (!isInternal(src)) continue;
    if (!existsSync(join(ROOT, src.split('?')[0]))) fail(`${rel} shows image ${src}, which does not exist`);
  }
  for (const m of prose.matchAll(/(?<!!)\[[^\]]*\]\(\s*(\/[^)\s]*)|\bhref=["'{`]*(\/[^"'}`\s>]*)/g)) {
    const href = m[1] ?? m[2];
    const target = clean(href);
    if (redirectSources.has(target)) {
      fail(`${rel} links to ${href}, a redirect source; link its destination`);
    } else if (resolvePage(href) === null && !generated.has(target) && !existsSync(join(ROOT, href.split('#')[0]))) {
      fail(`${rel} links to ${href}, which has no page`);
    }
  }
}

report('check-docs-site', failures, `${slugs.size} pages`);
