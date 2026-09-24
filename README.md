# OpenType docs

Source of [docs.opentype.dev](https://docs.opentype.dev), a [Mintlify](https://mintlify.com) site
built from the repository root. Contributor conventions are in [`AGENTS.md`](AGENTS.md).

```bash
npm run dev     # preview at http://localhost:3000
npm run check   # site and content checkers, then mint validate
npm test        # fixture tests for the checkers
```

Requires Node 22 or later. The checkers have no dependencies; `mint` is pinned in `package.json`
and `.github/workflows/ci.yml`.

`api-reference/openapi.json` is a scrubbed copy of the specification the API serves; see
"Refreshing the API reference" in `AGENTS.md` before replacing it.
