#!/usr/bin/env bash
# rollback.sh — Points the given service back to the previous healthy deploy.
# Usage: APPROVE=true SERVICE=orchestrator bash rollback.sh
set -euo pipefail

if [[ "${APPROVE:-false}" != "true" ]]; then
  echo "❌ Refusing to rollback: APPROVE env var is not set to 'true'."
  echo "   Re-run with: APPROVE=true bash rollback.sh"
  exit 1
fi

SERVICE="${SERVICE:?SERVICE is required (e.g. orchestrator, interface)}"

echo "⏪ Rolling back $SERVICE..."

case "$SERVICE" in
  interface)
    echo "Vercel rollback: promoting previous deployment..."
    # VERCEL_DEPLOYMENT_ID should be set to the target deployment URL or ID
    npx vercel rollback "${VERCEL_DEPLOYMENT_ID:?VERCEL_DEPLOYMENT_ID is required}" \
      --token "${VERCEL_TOKEN:?VERCEL_TOKEN is required}" \
      --yes
    ;;
  orchestrator)
    echo "Render rollback not directly supported via API."
    echo "Go to your Render dashboard and select a previous deploy to re-deploy it."
    echo "  https://dashboard.render.com"
    ;;
  *)
    echo "Unknown service: $SERVICE. Valid values: interface, orchestrator"
    exit 1
    ;;
esac

echo "✅ Rollback complete for $SERVICE."
