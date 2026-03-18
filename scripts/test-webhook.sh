#!/bin/bash
# Test webhook - fires a fake push event to local dev server

SECRET=$(grep GITHUB_WEBHOOK_SECRET /Users/spenc/buildlog/.env.local | cut -d'"' -f2)
PORT=${1:-3000}

PAYLOAD='{
  "installation": { "id": 99999 },
  "repository": { "id": 88888, "full_name": "spenc/buildlog" },
  "commits": [{ 
    "message": "feat: add Twitter OAuth integration",
    "url": "https://github.com/spenc/buildlog/commit/abc123"
  }]
}'

SIG="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

echo "→ Firing webhook to http://localhost:$PORT/api/webhooks/github"
curl -s -X POST "http://localhost:$PORT/api/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -H "x-hub-signature-256: $SIG" \
  -d "$PAYLOAD"
echo ""
