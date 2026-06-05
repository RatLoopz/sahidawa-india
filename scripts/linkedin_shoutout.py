#!/usr/bin/env python3
"""
SahiDawa LinkedIn Automated Shoutout Script
=============================================
Triggered by GitHub Actions when a 'level:advanced' or 'level:critical' PR is merged.

How it works:
1. Reads PR metadata from environment variables (set by GitHub Actions).
2. Calls Gemini AI to generate a unique, enthusiastic LinkedIn post.
3. Posts the content to LinkedIn via the UGC Posts API.

Environment Variables Required (set as GitHub Secrets):
  - LINKEDIN_ACCESS_TOKEN      : OAuth 2.0 Bearer Token with w_organization_social scope
  - LINKEDIN_ORGANIZATION_URN  : LinkedIn Org URN (e.g. urn:li:organization:12345678)
  - GEMINI_API_KEY             : Your Google Gemini API key
  - PR_TITLE                : Title of the merged PR
  - PR_AUTHOR               : GitHub username of the contributor
  - PR_URL                  : URL of the merged PR
  - PR_LABELS               : Comma-separated labels on the PR
  - PR_BODY                 : Description/body of the merged PR (optional)
  - PR_NUMBER               : PR number
  - PR_REPO                 : Repository name (e.g. RatLoopz/sahidawa-india)
"""

import os
import sys
import json
import requests
import re

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION — Edit these to change post tone/style
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_NAME = "SahiDawa"
PROJECT_TAGLINE = "India's open-source medicine safety platform for 1.4 billion people 🇮🇳"
PROJECT_GITHUB_URL = "https://github.com/RatLoopz/sahidawa-india"
PROJECT_HASHTAGS = "#SahiDawa #OpenSource #GSSoC2026 #BuildForIndia #HealthTech #IndiaStack"
LINKEDIN_API_URL = "https://api.linkedin.com/v2/ugcPosts"

# Label -> Human-readable tier for the post content
LABEL_TIER_MAP = {
    "level:critical": ("⚡ Critical-Level", "mission-critical"),
    "level:advanced": ("🔥 Advanced-Level", "highly complex"),
}


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Read environment variables
# ─────────────────────────────────────────────────────────────────────────────
def get_env_or_exit(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"❌ ERROR: Required environment variable '{key}' is missing or empty.")
        sys.exit(1)
    return val


def get_pr_metadata() -> dict:
    """Collect all PR information from environment variables."""
    return {
        "title": get_env_or_exit("PR_TITLE"),
        "author": get_env_or_exit("PR_AUTHOR"),
        "url": get_env_or_exit("PR_URL"),
        "number": os.environ.get("PR_NUMBER", "N/A"),
        "labels": os.environ.get("PR_LABELS", ""),
        "body": os.environ.get("PR_BODY", "").strip()[:500],  # Cap body at 500 chars
        "repo": os.environ.get("PR_REPO", "RatLoopz/sahidawa-india"),
    }


def determine_tier(labels_str: str) -> tuple:
    """Figure out post tier from label string. Returns (display_tier, description_tier)."""
    labels = [l.strip().lower() for l in labels_str.split(",")]
    for label in ["level:critical", "level:advanced"]:
        if label in labels:
            return LABEL_TIER_MAP[label]
    return ("🔥 Advanced-Level", "highly complex")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Generate post content with Gemini AI (Dynamic)
# ─────────────────────────────────────────────────────────────────────────────
def generate_post_with_gemini(pr: dict, tier_display: str, tier_desc: str) -> str:
    """
    Calls Gemini AI to generate a unique LinkedIn post.
    The post is dynamic — each merge will produce a different, human-sounding post.
    Falls back to a static template if the API call fails.
    """
    gemini_api_key = get_env_or_exit("GEMINI_API_KEY")

    system_prompt = f"""You are the social media voice of '{PROJECT_NAME}', {PROJECT_TAGLINE}.
Your job is to write an authentic, enthusiastic LinkedIn post to celebrate a contributor.
Keep it professional but warm. Use emojis appropriately but not excessively.
The post MUST feel human-written, not AI-generated or generic.
Never start with "I am" or "We are". Be creative with the opening line each time.
The post should be between 150-250 words. Do NOT include hashtags — they will be added separately."""

    user_prompt = f"""Write a LinkedIn shoutout post celebrating this open-source contribution:

Contributor GitHub Username: @{pr['author']}
PR Title: {pr['title']}
PR Number: #{pr['number']}
Tier: {tier_display} ({tier_desc} contribution)
PR Link: {pr['url']}
Project: {PROJECT_NAME} — {PROJECT_TAGLINE}
PR Description (if any): {pr['body'] if pr['body'] else 'Not provided'}

Requirements:
- Celebrate the contributor personally by name (@{pr['author']})
- Briefly explain what this PR does in simple terms anyone can understand
- Mention the '{tier_display}' difficulty they tackled
- Invite other developers to contribute to SahiDawa
- End with a call-to-action pointing to the PR or the GitHub repo
- Keep the tone warm, inspiring, and community-focused
- Do NOT mention any specific salary, reward, or monetary benefit"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.9,  # High temperature = more creative/unique
            "maxOutputTokens": 400,
        },
    }

    try:
        print("🤖 Calling Gemini AI to generate LinkedIn post...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        generated_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        print("✅ Gemini AI generated post successfully.")
        return generated_text
    except Exception as e:
        print(f"⚠️  Gemini AI call failed: {e}. Falling back to static template.")
        return generate_static_fallback_post(pr, tier_display)


def generate_static_fallback_post(pr: dict, tier_display: str) -> str:
    """
    Static fallback template used if Gemini API is unavailable.
    Still references dynamic PR data — it's not fully generic.
    """
    return f"""🌟 Celebrating an incredible contribution to {PROJECT_NAME}!

Massive shoutout to @{pr['author']} for landing PR #{pr['number']} — "{pr['title']}" — a {tier_display} contribution to our codebase!

{PROJECT_NAME} is {PROJECT_TAGLINE}. With 200+ contributors from across the country, every merged PR brings us closer to making quality healthcare information accessible to every Indian citizen.

This PR is live and making a real difference. Thank you, @{pr['author']}, for your dedication and technical expertise!

👉 Check out the contribution: {pr['url']}
🌐 Join us: {PROJECT_GITHUB_URL}

Are you a developer who wants to build tech for India? We have open issues for all skill levels — come build something meaningful!"""


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Assemble final post (Dynamic AI content + Static hashtags/links)
# ─────────────────────────────────────────────────────────────────────────────
def assemble_final_post(ai_content: str, pr: dict) -> str:
    """
    Combines the dynamic AI-generated body with our static project branding,
    hashtags, and links. This ensures consistent branding even when the main
    body varies each time.
    """
    # Clean up any extra whitespace from AI output
    clean_content = re.sub(r'\n{3,}', '\n\n', ai_content).strip()

    final_post = f"""{clean_content}

─────────────────────
🔗 PR: {pr['url']}
⭐ Star & Contribute: {PROJECT_GITHUB_URL}

{PROJECT_HASHTAGS}"""

    return final_post


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Post to LinkedIn via UGC Posts API
# ─────────────────────────────────────────────────────────────────────────────
def post_to_linkedin(post_text: str, pr: dict) -> None:
    """
    Makes the API call to publish the post on LinkedIn.
    Posts on behalf of the RatLoopz ORGANIZATION page (not personal profile).
    Uses the UGC (User Generated Content) Posts v2 API.

    Requires scopes: w_organization_social, r_organization_admin
    """
    access_token = get_env_or_exit("LINKEDIN_ACCESS_TOKEN")
    organization_urn = get_env_or_exit("LINKEDIN_ORGANIZATION_URN")
    # Validate format — must be urn:li:organization:XXXXXXXX
    if not organization_urn.startswith("urn:li:organization:"):
        print(f"❌ ERROR: LINKEDIN_ORGANIZATION_URN must start with 'urn:li:organization:' — got: {organization_urn}")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    # UGC Post payload — posts AS the organization, not a personal profile
    payload = {
        "author": organization_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": post_text
                },
                "shareMediaCategory": "ARTICLE",
                "media": [
                    {
                        "status": "READY",
                        "description": {
                            "text": f"View merged PR #{pr['number']} — {pr['title']}"
                        },
                        "originalUrl": pr["url"],
                        "title": {
                            "text": f"🎉 {pr['title']} — SahiDawa Open Source"
                        }
                    }
                ]
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }

    print(f"📤 Posting to LinkedIn as Organization: {organization_urn}")
    response = requests.post(LINKEDIN_API_URL, headers=headers, json=payload, timeout=30)

    if response.status_code in (200, 201):
        post_id = response.headers.get("x-restli-id", "N/A")
        print(f"✅ Successfully posted to LinkedIn! Post ID: {post_id}")
    else:
        print(f"❌ LinkedIn API Error: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  SahiDawa LinkedIn Shoutout Bot")
    print("=" * 60)

    # Step 1: Get PR data
    pr = get_pr_metadata()
    print(f"\n📋 PR Details:")
    print(f"   Title  : {pr['title']}")
    print(f"   Author : @{pr['author']}")
    print(f"   Number : #{pr['number']}")
    print(f"   Labels : {pr['labels']}")
    print(f"   URL    : {pr['url']}\n")

    # Step 2: Determine level tier
    tier_display, tier_desc = determine_tier(pr["labels"])
    print(f"🏆 Detected Tier: {tier_display}\n")

    # Step 3: Generate AI content
    ai_content = generate_post_with_gemini(pr, tier_display, tier_desc)

    # Step 4: Assemble final post
    final_post = assemble_final_post(ai_content, pr)

    print("\n" + "─" * 60)
    print("📝 FINAL LINKEDIN POST PREVIEW:")
    print("─" * 60)
    print(final_post)
    print("─" * 60 + "\n")

    # Step 5: Post to LinkedIn
    post_to_linkedin(final_post, pr)

    print("\n✅ Done! Shoutout posted successfully.")


if __name__ == "__main__":
    main()
