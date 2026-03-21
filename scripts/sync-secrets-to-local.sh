#!/bin/bash
# Sync secrets from Infisical to .env.local
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Syncing Infisical secrets → .env.local"
infisical export --env=dev --format=dotenv --output-file=.env.local
echo "Done. $(grep -c '=' .env.local) secrets written to .env.local"
