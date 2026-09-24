// Shared by check-docs-site.mjs and check-docs-content.mjs. Node >= 22, no dependencies.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(
  process.env.OPENTYPE_DOCS_ROOT ?? fileURLToPath(new URL('..', import.meta.url)),
);

const SKIP = new Set(['node_modules', '.git', '.github', '.mintlify', 'scripts']);

/** Every file under ROOT, as a POSIX path relative to ROOT. */
export function files(dir = ROOT, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const path = join(dir, ent.name);
    if (ent.isDirectory()) files(path, out);
    else out.push(relative(ROOT, path).split('\\').join('/'));
  }
  return out;
}

/** Every page: .mdx outside snippets/, as a slug ("guides/idempotency"). */
export function pageSlugs() {
  return files()
    .filter((rel) => rel.endsWith('.mdx') && !rel.startsWith('snippets/'))
    .map((rel) => rel.replace(/\.mdx$/, ''));
}

export function readText(rel) {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\r/g, '');
}

export function readJson(rel, fail) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    fail(`${rel} is missing`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`${rel} does not parse: ${err.message}`);
    return null;
  }
}

/** Flat `key: value` frontmatter. Returns null when there is none. */
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (m === null) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^"(.*)"$/.test(value)) value = value.slice(1, -1).replace(/\\"/g, '"');
    else if (/^'(.*)'$/.test(value)) value = value.slice(1, -1).replace(/''/g, "'");
    fm[kv[1]] = value;
  }
  return { fm, body: text.slice(m[0].length) };
}

const OPERATION = /^(GET|POST|PUT|PATCH|DELETE) (\/\S*)$/;

/** Navigation entries: { pages: slugs, operations: "METHOD /path" strings, hrefs }. */
export function collectNav(node, out = { pages: [], operations: [], hrefs: [] }) {
  if (node == null) return out;
  if (typeof node === 'string') {
    if (OPERATION.test(node)) out.operations.push(node);
    else out.pages.push(node.replace(/^\//, ''));
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectNav(item, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  if (typeof node.href === 'string') out.hrefs.push(node.href);
  // A group's root is the page its title opens; it is not repeated in `pages`.
  if (typeof node.root === 'string') collectNav(node.root, out);
  for (const key of ['pages', 'groups', 'tabs', 'anchors', 'dropdowns', 'items', 'links']) {
    if (Array.isArray(node[key])) collectNav(node[key], out);
  }
  if (node.global) collectNav(node.global, out);
  return out;
}

export function operationOf(entry) {
  const m = OPERATION.exec(entry);
  return m ? { method: m[1].toLowerCase(), path: m[2] } : null;
}

/** Split a path into segments; a {param} segment matches any segment. */
function segments(path) {
  return path.replace(/\/+$/, '').split('/');
}

/** True when `path` (from the docs) matches a path template in the spec. */
export function specHasPath(specPaths, path) {
  const want = segments(path);
  return specPaths.some((template) => {
    const have = segments(template);
    return (
      have.length === want.length &&
      have.every((seg, i) => /^\{[^}]+\}$/.test(seg) || seg === want[i])
    );
  });
}

export function report(name, failures, ok) {
  if (failures.length > 0) {
    console.error(`\n${name}: failed\n`);
    for (const message of failures) console.error(`  - ${message}`);
    console.error(`\n${failures.length} problem(s)`);
    process.exit(1);
  }
  console.log(`${name}: ok (${ok})`);
}
