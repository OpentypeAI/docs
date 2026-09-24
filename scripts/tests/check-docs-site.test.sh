#!/usr/bin/env bash
# A clean fixture tree passes scripts/check-docs-site.mjs; each broken copy fails
# with the message that names its fault.
set -euo pipefail
source "$(dirname "$0")/fixture.sh"
script="$root/scripts/check-docs-site.mjs"

must_pass "$tmp/good"
# The checker does not depend on the caller's directory.
(cd / && must_pass "$tmp/good")

d="$(fresh bad-json)"; printf '{' > "$d/docs.json"
must_fail "$d" "docs.json does not parse"

d="$(fresh missing-nav-page)"; rm "$d/guides/thing.mdx"
must_fail "$d" "navigation lists guides/thing, which has no guides/thing.mdx"

d="$(fresh orphan)"; page "$d" guides/orphan "Orphan"
must_fail "$d" "guides/orphan.mdx is not in docs.json navigation"

d="$(fresh bad-operation)"; sed -i 's|"GET /v1/runs/{run_id}"|"DELETE /v1/runs/{run_id}"|' "$d/docs.json"
must_fail "$d" '"DELETE /v1/runs/{run_id}", which is not in api-reference/openapi.json'

d="$(fresh dup-title)"; sed -i 's/^title: "The thing"/title: "Home"/' "$d/guides/thing.mdx"
must_fail "$d" 'repeats the title "Home"'

d="$(fresh no-description)"; sed -i '/^description:/d' "$d/guides/thing.mdx"
must_fail "$d" "guides/thing.mdx has no description"

d="$(fresh long-description)"
sed -i "s/^description: .*/description: \"$(printf 'x%.0s' $(seq 1 161))\"/" "$d/guides/thing.mdx"
must_fail "$d" "description is 161 characters (max 160)"

d="$(fresh no-icon)"; sed -i '/^icon:/d' "$d/guides/thing.mdx"
must_fail "$d" "guides/thing.mdx has no icon"

d="$(fresh dead-link)"; printf '\nSee [nothing](/guides/nothing).\n' >> "$d/index.mdx"
must_fail "$d" "links to /guides/nothing, which has no page"

d="$(fresh dead-href)"; printf '\n<Card title="x" icon="x" href="/console/nothing" />\n' >> "$d/index.mdx"
must_fail "$d" "links to /console/nothing, which has no page"

d="$(fresh link-to-redirect)"; printf '\nSee [old](/old-guide).\n' >> "$d/index.mdx"
must_fail "$d" "a redirect source; link its destination"

d="$(fresh dead-image)"; sed -i 's|/images/product/shot.png|/images/product/gone.png|' "$d/index.mdx"
must_fail "$d" "shows image /images/product/gone.png, which does not exist"

d="$(fresh dead-redirect)"; sed -i 's|"destination": "/guides/thing"|"destination": "/guides/gone"|' "$d/docs.json"
must_fail "$d" "redirect /old-guide -> /guides/gone: the destination has no page"

d="$(fresh redirect-collision)"; sed -i 's|"source": "/old-guide"|"source": "/guides/thing"|' "$d/docs.json"
must_fail "$d" "redirect source /guides/thing collides with the page guides/thing.mdx"

d="$(fresh dead-footer)"; sed -i 's|"href": "/guides/thing"|"href": "/guides/gone"|' "$d/docs.json"
must_fail "$d" "docs.json links to /guides/gone, which has no page"

echo "check-docs-site.test.sh: ok"
