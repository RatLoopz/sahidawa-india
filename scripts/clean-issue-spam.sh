#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: ./clean-issue-spam.sh <issue_number>"
    exit 1
fi

ISSUE_NUM=$1
echo "🧹 Scanning issue #$ISSUE_NUM for spam comments..."

# Fetch all comments for the issue
COMMENTS=$(gh api /repos/{owner}/{repo}/issues/$ISSUE_NUM/comments | jq -c '.[] | {id: .id, author: .user.login, body: .body}')

if [ -z "$COMMENTS" ]; then
    echo "No comments found on issue #$ISSUE_NUM."
    exit 0
fi

echo "$COMMENTS" | while read -r comment; do
    ID=$(echo "$comment" | jq -r '.id')
    AUTHOR=$(echo "$comment" | jq -r '.author')
    BODY=$(echo "$comment" | jq -r '.body')
    
    DELETE=false
    REASON=""

    # 1. Delete bot spam (warnings, unassignments)
    if [ "$AUTHOR" = "github-actions[bot]" ]; then
        # Check if it's an assignment warning/unassignment or denied request
        if echo "$BODY" | grep -qiE "(⚠️|You've been assigned|Assignment Request Denied|already assigned|Auto-unassigned|inactivity)"; then
            DELETE=true
            REASON="Bot assignment/warning spam"
        fi
    fi

    # 2. Delete empty/spammy "/assign" requests from users
    if [ "$AUTHOR" != "github-actions[bot]" ]; then
        CLEANED_BODY=$(echo "$BODY" | sed -E 's/\/assign|please assign me|assign me//Ig' | tr -d '\n\r' | awk '{$1=$1;print}')
        
        # If the body is mostly just "assign" requests with very little substance
        if [ ${#CLEANED_BODY} -lt 30 ] && echo "$BODY" | grep -qiE "(/assign|assign me)"; then
            DELETE=true
            REASON="Empty assignment request without implementation approach"
        fi
    fi

    if [ "$DELETE" = true ]; then
        echo "🗑️ Deleting comment $ID by @$AUTHOR (Reason: $REASON)"
        gh api -X DELETE /repos/{owner}/{repo}/issues/comments/$ID --silent || echo "Failed to delete $ID (Might need admin permissions)"
    fi
done

echo "✨ Cleanup complete!"
