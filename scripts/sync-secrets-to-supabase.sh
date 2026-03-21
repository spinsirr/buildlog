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

# Build supabase secrets set args
ARGS=""
for key in "${EDGE_KEYS[@]}"; do
  val=$(grep "^${key}=" "$TMPFILE" | cut -d'=' -f2- || true)
  if [ -n "$val" ]; then
    ARGS="$ARGS ${key}=${val}"
  else
    echo "  ⚠ $key not found in Infisical, skipping"
  fi
done

if [ -n "$ARGS" ]; then
  # shellcheck disable=SC2086
  npx supabase secrets set $ARGS
  echo "Done."
else
  echo "No secrets to sync."
fi
