#!/usr/bin/env bash
# A clean fixture tree passes scripts/check-docs-content.mjs; each broken copy fails
# with the message that names its fault. Also pins the exemptions: api-reference
# pages need no Related section, and placeholders such as otsk_... are fine.
set -euo pipefail
source "$(dirname "$0")/fixture.sh"
script="$root/scripts/check-docs-content.mjs"

must_pass "$tmp/good"
d="$(fresh api-no-related)"; sed -i '/^## Related/,$d' "$d/api-reference/introduction.mdx"
must_pass "$d"

for term in AWS Kubernetes WorkOS Cloudflare Gemma neo_ catalog.example; do
  d="$(fresh "banned-$term")"; sed -i "s/^Poll /Runs on $term. Poll /" "$d/guides/thing.mdx"
  must_fail "$d" "guides/thing: banned term $term"
done

for secret in sk_live_abc sk_test_abc rk_live_abc whsec_abc cfat_abc "otsk_$(printf 'ab%.0s' $(seq 1 32))"; do
  d="$(fresh "secret-${secret:0:6}")"; printf '\n`%s`\n' "$secret" >> "$d/index.mdx"
  must_fail "$d" "index: banned term ${secret%%_*}_"
done

d="$(fresh no-related)"; sed -i '/^## Related/,$d' "$d/guides/thing.mdx"
must_fail "$d" 'guides/thing: must end with a "## Related" section'

d="$(fresh related-not-last)"; printf '\n## Afterwards\n\nMore.\n' >> "$d/guides/thing.mdx"
must_fail "$d" 'guides/thing: must end with a "## Related" section'

d="$(fresh bad-host)"; printf '\nSee https://example.com/x.\n' >> "$d/index.mdx"
must_fail "$d" "absolute link outside opentype.dev"

d="$(fresh lookalike-host)"; printf '\nSee https://opentype.dev.evil.io/x.\n' >> "$d/index.mdx"
must_fail "$d" "absolute link outside opentype.dev"

d="$(fresh bad-path)"; printf '\n```bash\ncurl https://api.opentype.dev/v1/members\n```\n' >> "$d/index.mdx"
must_fail "$d" "/v1/members (line"

d="$(fresh bad-prose-path)"; printf '\nCall `GET /v1/runs/{run_id}/cancel`.\n' >> "$d/index.mdx"
must_fail "$d" "/v1/runs/{run_id}/cancel (line"

d="$(fresh missing-code)"; sed -i 's/not_found_run/something_else/' "$d/reference/errors.mdx"
must_fail "$d" "code not_found_run does not appear in reference/errors.mdx"

echo "check-docs-content.test.sh: ok"
