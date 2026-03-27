#!/bin/bash
# Sync secrets from Infisical to Supabase Edge Functions
set -euo pipefail

cd "$(dirname "$0")/.."

# Keys that Supabase Edge Functions need (skip NEXT_PUBLIC_ and VERCEL_ prefixed)
EDGE_KEYS=(
  GITHUB_WEBHOOK_SECRET
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRO_PRICE_ID
  TWITTER_CLIENT_ID
  TWITTER_CLIENT_SECRET
  TOKEN_ENCRYPTION_KEY
  GITHUB_APP_ID
  GITHUB_APP_PRIVATE_KEY
  GEMINI_API_KEY
)

echo "Syncing Infisical secrets → Supabase Edge Functions"

# Export all secrets to temp file
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
infisical export --env=dev --format=dotenv --output-file="$TMPFILE"

# Set secrets one at a time to safely handle multiline values (PEM keys etc.)
COUNT=0
for key in "${EDGE_KEYS[@]}"; do
  # Use python to correctly parse dotenv values (handles multiline quoted strings)
  val=$(python3 -c "
import re, sys
content = open(sys.argv[1]).read()
# Try quoted value first (handles multiline like PEM keys)
m = re.search(r'^' + sys.argv[2] + r'=\"((?:[^\\\\\"]|\\\\.)*)\"', content, re.MULTILINE | re.DOTALL)
if not m:
    # Fall back to unquoted single-line value
    m = re.search(r'^' + sys.argv[2] + r'=(.+)$', content, re.MULTILINE)
if m:
    print(m.group(1), end='')
" "$TMPFILE" "$key" 2>/dev/null || true)

  if [ -n "$val" ]; then
    bunx supabase secrets set "${key}=${val}"
    COUNT=$((COUNT + 1))
  else
    echo "  ⚠ $key not found in Infisical, skipping"
  fi
done

if [ "$COUNT" -gt 0 ]; then
  echo "Done. Set $COUNT secrets."
else
  echo "No secrets to sync."
fi
