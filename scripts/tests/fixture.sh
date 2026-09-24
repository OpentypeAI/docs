# Sourced by the *.test.sh files. Builds a minimal, clean OpenType docs tree that
# both checkers pass, plus helpers to assert a checker passes or fails with a message.

fail() { echo "$(basename "$0"): $*" >&2; exit 1; }

page() { # page <dir> <slug> <title> [body]
  local dir="$1" slug="$2" title="$3" body="${4:-Body text.}"
  mkdir -p "$(dirname "$dir/$slug.mdx")"
  cat > "$dir/$slug.mdx" <<MDX
---
title: "$title"
description: "What the $title page is for."
icon: "book"
---

$body

## Related

- [Home](/) - start over.
MDX
}

seed() {
  local dir="$1"
  mkdir -p "$dir/logo" "$dir/images/product" "$dir/api-reference"
  printf '<svg xmlns="http://www.w3.org/2000/svg"></svg>' > "$dir/favicon.svg"
  cp "$dir/favicon.svg" "$dir/logo/light.svg"
  cp "$dir/favicon.svg" "$dir/logo/dark.svg"
  printf 'png' > "$dir/images/product/shot.png"
  cat > "$dir/api-reference/openapi.json" <<'JSON'
{ "openapi": "3.1.0", "info": { "title": "t", "version": "1" },
  "paths": { "/v1/runs": { "post": {} }, "/v1/runs/{run_id}": { "get": {} } } }
JSON
  page "$dir" index "Home" "Send \`POST /v1/runs\`, then read \`GET /v1/runs/{run_id}\` at https://api.opentype.dev/v1/runs. See the [guide](/guides/thing), [billing](https://github.com/OpentypeAI/docs) and <Frame><img src=\"/images/product/shot.png\" alt=\"A shot\" /></Frame>"
  page "$dir" guides/thing "The thing" "Poll \`https://api.opentype.dev/v1/runs/\${runId}\` with a key like \`otsk_...\`."
  page "$dir" api-reference/introduction "API introduction"
  page "$dir" reference/errors "Errors" "| \`not_found_run\` | gone |"
  page "$dir" problems/not_found_run "not_found_run"
  mkdir -p "$dir/snippets"
  printf 'A snippet, not a page.\n' > "$dir/snippets/note.mdx"
  cat > "$dir/docs.json" <<'JSON'
{
  "name": "OpenType",
  "favicon": "/favicon.svg",
  "logo": { "light": "/logo/light.svg", "dark": "/logo/dark.svg" },
  "navbar": { "links": [ { "label": "Console", "href": "https://console.opentype.dev" } ] },
  "navigation": {
    "tabs": [
      { "tab": "Docs", "groups": [ { "group": "All", "pages": [
        "index", "guides/thing", "reference/errors", "problems/not_found_run" ] } ] },
      { "tab": "API", "openapi": "api-reference/openapi.json", "groups": [ { "group": "Runs", "pages": [
        "api-reference/introduction", "POST /v1/runs", "GET /v1/runs/{run_id}" ] } ] }
    ]
  },
  "footer": { "links": [ { "header": "Docs", "items": [ { "label": "Guide", "href": "/guides/thing" } ] } ] },
  "redirects": [ { "source": "/old-guide", "destination": "/guides/thing" } ]
}
JSON
}

# fresh <name>: a clean copy of the good tree at $tmp/<name>; prints its path.
fresh() { local d="$tmp/$1"; rm -rf "$d"; cp -r "$tmp/good" "$d"; printf '%s' "$d"; }

run() { OPENTYPE_DOCS_ROOT="$1" node "$script" "${@:2}" 2>&1; }

must_pass() {
  local out
  out="$(run "$1")" || fail "expected $1 to pass, got: $out"
}

must_fail() {
  local dir="$1" needle="$2" out
  if out="$(run "$dir")"; then fail "expected failure mentioning '$needle', got success: $out"; fi
  printf '%s' "$out" | grep -qF -- "$needle" || fail "expected output to mention '$needle', got: $out"
}

root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
seed "$tmp/good"
