#!/usr/bin/env bash
# One-shot Vercel deploy for the Framers homepage preview.
# Prereq (run once, interactive): npx vercel login
#
# This script:
#   1. Links (or creates) a Vercel project for this folder.
#   2. Uploads every var from .env.local to the Production environment.
#   3. Deploys to production and prints the public URL.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found in $(pwd)"; exit 1
fi

echo "==> Linking project (uses defaults; creates one if needed)…"
npx --yes vercel link --yes

echo "==> Uploading env vars from .env.local to Production…"
# shellcheck disable=SC2162
while IFS= read -r line || [ -n "$line" ]; do
  # skip blanks and comments
  case "$line" in ''|\#*) continue;; esac
  key="${line%%=*}"
  val="${line#*=}"
  # strip surrounding quotes if present
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  [ -z "$key" ] && continue
  # make idempotent: remove if it already exists, then add
  npx --yes vercel env rm "$key" production -y >/dev/null 2>&1 || true
  printf '%s' "$val" | npx --yes vercel env add "$key" production >/dev/null 2>&1 \
    && echo "    + $key" || echo "    ! failed: $key"
done < .env.local

echo "==> Deploying to production…"
npx --yes vercel --prod --yes
