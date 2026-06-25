#!/usr/bin/env bash
# scaffold.sh — Creates a new app repo from a template.
# Usage: REPO_NAME=my-app TEMPLATE=nextjs bash scaffold.sh
set -euo pipefail

REPO_NAME="${REPO_NAME:?REPO_NAME is required}"
TEMPLATE="${TEMPLATE:-nextjs}"
TEMPLATES_DIR="$(cd "$(dirname "$0")/../templates" && pwd)"

echo "Scaffolding new app: $REPO_NAME from template: $TEMPLATE"

if [[ ! -d "$TEMPLATES_DIR/$TEMPLATE" ]]; then
  echo "Template '$TEMPLATE' not found in $TEMPLATES_DIR"
  exit 1
fi

# Create a fresh directory and copy template
TARGET_DIR="$(pwd)/$REPO_NAME"
if [[ -d "$TARGET_DIR" ]]; then
  echo "Error: $TARGET_DIR already exists. Aborting to prevent data loss."
  exit 1
fi

cp -r "$TEMPLATES_DIR/$TEMPLATE" "$TARGET_DIR"

# Init git
cd "$TARGET_DIR"
git init
git add .
git commit -m "chore: scaffold from $TEMPLATE template"

echo "✅ App scaffolded at $TARGET_DIR"
echo "Next steps:"
echo "  cd $REPO_NAME && npm install"
echo "  Create a GitHub repo and push: git remote add origin <URL> && git push -u origin main"
