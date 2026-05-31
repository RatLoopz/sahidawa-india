#!/bin/bash

# clean-merge-pr.sh
# Automates cleanly cherry-picking and merging ONLY the relevant files from a PR branch 
# into the current main branch, completely bypassing unrelated changes/regressions.

set -e

PR_NUMBER=$1
shift
FILES=("$@")

if [ -z "$PR_NUMBER" ] || [ ${#FILES[@]} -eq 0 ]; then
    echo "Usage: ./scripts/clean-merge-pr.sh <PR_NUMBER> <file1> <file2> [file3...]"
    exit 1
fi

echo "🔄 Step 1: Making sure local main is up-to-date..."
git checkout main
git pull origin main

echo "📥 Step 2: Fetching PR #$PR_NUMBER branch..."
git fetch origin pull/$PR_NUMBER/head:pr-$PR_NUMBER

echo "🧹 Step 3: Checking out ONLY the specified clean files from PR branch..."
for FILE in "${FILES[@]}"; do
    echo "  -> Checking out $FILE..."
    git checkout pr-$PR_NUMBER -- "$FILE"
done

echo "📦 Step 4: Running npm install to sync lockfile/dependencies..."
npm ci

echo "🧪 Step 5: Running tests to verify merge integrity..."
npm run test --workspace=web || {
    echo "❌ Tests failed! Aborting merge."
    exit 1
}

echo "✅ Step 6: Staging and committing clean changes..."
git add "${FILES[@]}"
git commit -m "feat: cleanly merged verified changes from PR #$PR_NUMBER"

echo "🚀 Step 7: Pushing to remote main..."
git push origin main

echo "🎉 PR #$PR_NUMBER cleanly merged without regressions!"
