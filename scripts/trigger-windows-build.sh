#!/usr/bin/env bash
# Trigger the GitHub Actions "Build Windows" workflow and optionally wait for
# it and download the Windows installer artifact.
# Requires: gh CLI (https://cli.github.com/) installed and authenticated.
set -e

WORKFLOW="build-windows.yml"

if ! command -v gh &>/dev/null; then
  echo "Error: GitHub CLI (gh) is not installed or not in PATH."
  echo "Install it: https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Error: Not logged in to GitHub. Run: gh auth login"
  exit 1
fi

echo "Triggering workflow: $WORKFLOW"
gh workflow run "$WORKFLOW"

echo "Waiting for the run to appear..."
sleep 5

# Get the most recent run for this workflow (the one we just started)
RUN_ID=$(gh run list --workflow="$WORKFLOW" --limit 1 --json databaseId,status --jq '.[0].databaseId')
if [[ -z "$RUN_ID" ]]; then
  echo "Could not find a run. Check Actions tab: https://github.com/$(gh repo view --json nameWithOwner -q nameWithOwner)/actions"
  exit 1
fi

echo "Watching run ID: $RUN_ID"
gh run watch "$RUN_ID"

echo "Downloading artifacts..."
gh run download "$RUN_ID" --dir dist-windows

echo "Done. Windows installer files are in dist-windows/"
