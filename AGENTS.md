# OpenType public documentation

This is the Mintlify site for `docs.opentype.dev`. The API is at `https://api.opentype.dev`
and the console at `https://console.opentype.dev`. Edit the site at the repository root;
preview and check commands are in `README.md`.

## What the site is

End-user documentation for developers calling the OpenType API and people using the console.

- English, second person, present tense, sentence-case headings. No emoji, no marketing fluff.
- The model is **Neon 1.1**. API ids are `neon-1.1` and `neon-latest`. Use no other model name.
- Sign-up is open and a verified email receives $5 of free credit, once per email address.
- Describe console sign-in at user level only: what a person clicks, never the protocol.
- No infrastructure, hosting or vendor details; no credentials. Stripe is named only where the
  reader sees it: checkout, the billing portal and receipts. `scripts/check-docs-content.mjs`
  holds the banned-term list.
- Do not document routes, fields, headers or states the public API does not offer: sign-in and
  member routes, webhooks, internal error codes, or retry hints the API does not send. If a fact
  is not verified against the running service, leave it out.
- Secrets in examples are placeholders: write `otsk_...`, never a full-length key.
- Absolute links go only to `*.opentype.dev`, `github.com/OpentypeAI` and `stripe.com`. Never
  link the bare apex `https://opentype.dev`.

## Page shape

Every page has frontmatter:

```yaml
---
title: "Idempotency"            # unique across the site
sidebarTitle: "Idempotency"     # only when the title is long
description: "..."              # 160 characters or fewer
icon: "arrows-rotate"           # Font Awesome name
keywords: ["retry", "Idempotency-Key"]
---
```

The first paragraph says what the page is for and who needs it. Code samples are a `<CodeGroup>`
with curl, TypeScript (`fetch`) and Python (`requests`), reading the key from
`OPENTYPE_API_KEY`, with real field names. Screenshots are local `/images/product/*.png` inside
`<Frame>`, with descriptive alt text. Internal links are absolute and have no `.mdx`:
`[Idempotency](/guides/idempotency)`.

Every page except the API reference and `problems/index` ends with:

```md
## Related

- [Title](/path) - why you would go there.
```

with three to five entries.

Page types:

| Type | Where | Shape |
| --- | --- | --- |
| Hub | `index`, `<tab>/index` | One paragraph, then a `<CardGroup>` with a card (with `icon`) per page of the tab. |
| Concept | `getting-started/` | What it is, how it behaves, one example. |
| Guide | `guides/` | A task from start to finish, with a `<CodeGroup>` at each step. |
| Console | `console/` | Screen by screen, with screenshots. |
| Reference | `reference/`, `security/` | Tables and exact rules. |
| Problem | `problems/<code>.mdx` | One per error code, see below. |
| API reference | `api-reference/` | Generated from `api-reference/openapi.json`; only `introduction.mdx` is hand-written. |

## Adding a page

1. Create the `.mdx` with full frontmatter and a closing `## Related` section.
2. Add its slug to the right group in `docs.json` navigation. Every page must be in navigation,
   and every navigation entry must have a page. Files under `snippets/` are not pages.
3. Link it from its tab's hub and from the `## Related` sections of neighbouring pages.
4. When you move or rename a page, add a `redirects` entry to `docs.json` from the old path to the
   new one and update every link to point at the new path. A redirect source may not be an
   existing page, and pages must not link to a redirect source.

## Adding a problem page

Each error code the API returns has `problems/<code>.mdx`, titled with the code:

1. A one-line intro, then a table: HTTP status, `code`, whether a retry can succeed.
2. `## What happened`: the exact trigger and the routes that return it.
3. `## How to fix`: the client action, including whether to reuse the `Idempotency-Key` or send a
   new one.
4. `## Example`: the error body `{ "error": { "code", "message", "request_id" } }`.
5. `## Related`.

Add the slug to the "Problem codes" group in `docs.json`, a row to the table in `problems/index`,
and the code to `reference/errors.mdx`. The content checker fails if a problem page's code is
missing from `reference/errors.mdx`.

## Refreshing the API reference

`api-reference/openapi.json` is a copy of the specification the API serves, scrubbed for the
public site; `api-reference/overlays/opentype-overlay.json` adds summaries, page addresses (`x-mint.href`)
and the security scheme.

1. Take the current specification from the service.
2. Remove the paths and schemas the docs do not cover (sign-in, members, webhooks) and rewrite
   any description that names infrastructure, vendors or internal components.
3. Replace `api-reference/openapi.json`, then update the overlay and the operation entries in
   `docs.json` navigation for any added or removed operation.
4. Run the checks. The site checker fails on a navigation operation that is not in the spec; the
   content checker fails on any `/v1/` path in a page that is not in the spec.

## Running checks

```bash
node scripts/check-docs-site.mjs        # docs.json, navigation, frontmatter, links, images, redirects
node scripts/check-docs-content.mjs     # banned terms, secrets, Related, hosts, /v1 paths, error codes
bash scripts/tests/check-docs-site.test.sh
bash scripts/tests/check-docs-content.test.sh
npm exec --yes --package=mint@4.2.930 -- mint validate
```

`npm run check` and `npm test` run the same set. CI runs all of them on every pull request.
Pass a slug to check one page: `node scripts/check-docs-content.mjs guides/idempotency`.

Do not change the Mintlify integration, the custom domain or DNS without an explicit request.
