#!/usr/bin/env bash
# deploy.sh — MANUAL deploy trigger.
# Must be called with APPROVE=true or it will refuse to run.
# Usage: APPROVE=true SERVICE=orchestrator bash deploy.sh
set -euo pipefail

if [[ "${APPROVE:-false}" != "true" ]]; then
  echo "❌ Refusing to deploy: APPROVE env var is not set to 'true'."
  echo "   Re-run with: APPROVE=true bash deploy.sh"
  exit 1
fi

SERVICE="${SERVICE:?SERVICE is required (e.g. orchestrator, interface)}"

echo "✅ Approval confirmed. Deploying $SERVICE..."

case "$SERVICE" in
  interface)
    echo "Triggering Vercel deploy for interface..."
    # Requires VERCEL_TOKEN in environment
    npx vercel --prod --yes --token "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
    ;;
  orchestrator)
    echo "Triggering Render deploy for orchestrator via webhook..."
    curl --fail --silent --show-error \
      --request POST \
      "${RENDER_DEPLOY_HOOK_URL:?RENDER_DEPLOY_HOOK_URL is required}"
    echo ""
    ;;
  *)
    echo "Unknown service: $SERVICE. Valid values: interface, orchestrator"
    exit 1
    ;;
esac

echo "🚀 Deploy triggered for $SERVICE."
