#!/usr/bin/env bash
# Builds, deploys to Vercel production and checks that the site answers.
# Run from the repo root: bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

npm test
npm run build
npx --yes vercel@65.11.0 --prod --yes

status=$(curl -s -o /dev/null -w "%{http_code}" https://teoritraning.vercel.app/)
if [ "$status" != "200" ]; then
  echo "Deploy klar men sidan svarar $status" >&2
  exit 1
fi
echo "Deploy klar: https://teoritraning.vercel.app svarar 200"
