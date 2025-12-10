#!/bin/bash

# Script to update PR description from PR_DESCRIPTION_*.md file
# Usage: ./scripts/update-pr-description.sh [pr-number]

set -e

# Find PR description file
DESC_FILE=$(find . -maxdepth 1 -name "PR_DESCRIPTION*.md" | head -1)

if [ -z "$DESC_FILE" ]; then
  echo "❌ No PR_DESCRIPTION_*.md file found in root directory"
  exit 1
fi

echo "📝 Found description file: $DESC_FILE"

# Get PR number from argument or current branch
if [ -n "$1" ]; then
  PR_NUMBER="$1"
else
  # Try to get PR number from current branch
  BRANCH=$(git branch --show-current)
  PR_NUMBER=$(gh pr list --head "$BRANCH" --json number -q '.[0].number' 2>/dev/null || echo "")
  
  if [ -z "$PR_NUMBER" ]; then
    echo "❌ Could not find PR number. Please provide it as argument:"
    echo "   ./scripts/update-pr-description.sh <pr-number>"
    exit 1
  fi
fi

echo "🔗 Updating PR #$PR_NUMBER..."

# Update PR description using GitHub CLI
gh pr edit "$PR_NUMBER" --body-file "$DESC_FILE"

echo "✅ PR description updated successfully!"

