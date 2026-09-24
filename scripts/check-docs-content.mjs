#!/usr/bin/env node
/**
 * Checks what is inside each page (check-docs-site.mjs checks the site's shape):
 *
 *   - banned terms: infrastructure, hosting and vendor names, internal codenames
 *   - secret-shaped strings: live and test keys, webhook secrets, API tokens,
 *     and a full-length OpenType secret (otsk_ + 64 hex)
 *   - every page ends with a "## Related" section, except the API reference
 *     and the pages in RELATED_EXEMPT
 *   - absolute links stay on opentype.dev, github.com/OpentypeAI or stripe.com
 *   - every /v1/ path in prose or code exists in api-reference/openapi.json
 *   - every problems/<code>.mdx code appears in reference/errors.mdx
 *
 * Usage:
 *   node scripts/check-docs-content.mjs                     every page
 *   node scripts/check-docs-content.mjs guides/idempotency  one page (slug)
 * Set OPENTYPE_DOCS_ROOT to check another tree (the fixture tests do).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, frontmatter, pageSlugs, readJson, readText, report, specHasPath } from './lib.mjs';

// Case-sensitive, whole word unless noted. "Stripe" is allowed: checkout,
// portal and receipts are Stripe-hosted pages the reader actually sees.
const BANNED = [
  'Modal', 'AWS', 'EKS', 'Kubernetes', 'GPU', 'B300', 'vLLM', 'djev', 'Jev', 'Gemma',
  'gemma_local', 'DiffusionGemma', 'diffusion_read', 'Cloudflare', 'WorkOS', 'Paper',
  'typesafe', 'crate', 'companion', 'accelerator',
].map((word) => [new RegExp(`\\b${word}\\b`), word]);
BANNED.push([/\bneo_/, 'neo_'], [/catalog\.example/, 'catalog.example']);

const SECRETS = [
  [/sk_live_/, 'sk_live_'],
  [/sk_test_/, 'sk_test_'],
  [/rk_live_/, 'rk_live_'],
  [/whsec_/, 'whsec_'],
  [/cfat_/, 'cfat_'],
  [/otsk_[0-9a-f]{64}(?![0-9a-f])/, 'otsk_ + 64 hex (write otsk_... instead)'],
];

// Hubs that are a card grid or a table with nothing to relate to.
const RELATED_EXEMPT = new Set(['problems/index']);

const HOST_ALLOWED = [
  /^https?:\/\/(?:[a-z0-9-]+\.)*opentype\.dev(?![a-z0-9.-])/,
  /^https?:\/\/github\.com\/OpentypeAI(?![A-Za-z0-9.-])/,
  /^https?:\/\/(?:[a-z0-9-]+\.)*stripe\.com(?![a-z0-9.-])/,
];

const failures = [];
const fail = (message) => failures.push(message);

const spec = readJson('api-reference/openapi.json', fail);
const specPaths = Object.keys(spec?.paths ?? {});

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function checkPage(slug) {
  const rel = `${slug}.mdx`;
  if (!existsSync(join(ROOT, rel))) return fail(`${slug}: no such page`);
  const text = readText(rel);
  const body = frontmatter(text)?.body ?? text;

  for (const [re, label] of [...BANNED, ...SECRETS]) {
    const m = re.exec(text);
    if (m) fail(`${slug}: banned term ${label} at line ${lineOf(text, m.index)}`);
  }

  if (!slug.startsWith('api-reference/') && !RELATED_EXEMPT.has(slug)) {
    const headings = [...body.matchAll(/^## (.+)$/gm)];
    const last = headings.at(-1)?.[1].trim();
    if (last !== 'Related') fail(`${slug}: must end with a "## Related" section`);
  }

  for (const m of text.matchAll(/https?:\/\/[^\s)"'`<>\]]+/g)) {
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1)\b/.test(m[0])) continue;
    if (!HOST_ALLOWED.some((re) => re.test(m[0]))) {
      fail(`${slug}: absolute link outside opentype.dev at line ${lineOf(text, m.index)}: ${m[0]}`);
    }
  }

  // Template variables (${runId}, $RUN_ID, {run_id}) all stand for one segment.
  for (const m of text.matchAll(/\/v1\/[A-Za-z0-9._~{}$\-/]*/g)) {
    let path = m[0].replace(/\$\{[^}]*\}|\$[A-Z_]+/g, '{x}').replace(/[.]+$/, '').replace(/\/$/, '');
    if (path === '/v1' || /[*]/.test(path)) continue;
    if (!specHasPath(specPaths, path)) {
      fail(`${slug}: ${path} (line ${lineOf(text, m.index)}) is not in api-reference/openapi.json`);
    }
  }
}

const all = pageSlugs();
const args = process.argv.slice(2).map((a) => a.replace(/\.mdx$/, '').replace(/^\//, ''));
for (const slug of args.length ? args : all) checkPage(slug);

if (!args.length) {
  const errors = existsSync(join(ROOT, 'reference/errors.mdx')) ? readText('reference/errors.mdx') : '';
  for (const slug of all.filter((s) => s.startsWith('problems/') && s !== 'problems/index')) {
    const code = slug.slice('problems/'.length);
    if (!new RegExp(`\\b${code}\\b`).test(errors)) {
      fail(`${slug}: code ${code} does not appear in reference/errors.mdx`);
    }
  }
}

report('check-docs-content', failures, `${args.length || all.length} page(s)`);
