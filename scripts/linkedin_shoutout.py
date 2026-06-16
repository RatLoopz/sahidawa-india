#!/usr/bin/env python3
"""
SahiDawa LinkedIn Automated Shoutout Script (via Make.com Webhook)
===================================================================
Flow:
  1. PR is merged with level:advanced or level:critical label
  2. GitHub Actions calls this script
  3. Script generates a unique post using Gemini AI
  4. Script sends the post as JSON to a Make.com webhook
  5. Make.com posts it to LinkedIn Company Page (no Advertising API needed)

Environment Variables Required (set as GitHub Secrets):
  - MAKE_WEBHOOK_URL  : Make.com webhook URL (https://hook.eu1.make.com/...)
  - GEMINI_API_KEY    : Google Gemini API key
  - PR_TITLE          : Title of the merged PR
  - PR_AUTHOR         : GitHub username of the contributor
  - PR_URL            : URL of the merged PR
  - PR_LABELS         : Comma-separated labels on the PR
  - PR_BODY           : Description/body of the merged PR (optional)
  - PR_NUMBER         : PR number
  - PR_REPO           : Repository name (e.g. RatLoopz/sahidawa-india)
  - PR_LINES_CHANGED  : Total lines added + deleted in the PR
  - PR_GIT_DIFF       : The actual code diff (passed from GitHub actions)
"""

import os
import sys
import re
import json
import requests

# ─────────────────────────────────────────────────────────────────────────────
# PROJECT CONFIG — Edit these to change branding
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_NAME = "SahiDawa"
PROJECT_TAGLINE = "India's open-source medicine safety platform for 1.4 billion people 🇮🇳"
PROJECT_GITHUB_URL = "https://github.com/RatLoopz/sahidawa-india"
PROJECT_HASHTAGS = "#GSSoC2026 #OpenSource #girlscriptsummerofcode #RatLoopz #community #mentorship #leadership #developerJourney #collaboration #contributors #TechCommunity #GSSoC #GitHub #SahiDawa #BuildForIndia"

LABEL_TIER_MAP = {
    "level:critical": ("⚡ Critical-Level", "mission-critical"),
    "level:advanced": ("🔥 Advanced-Level", "highly complex"),
}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def get_env_or_exit(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"❌ ERROR: Required environment variable '{key}' is missing or empty.")
        sys.exit(1)
    return val


def get_pr_metadata() -> dict:
    return {
        "title": get_env_or_exit("PR_TITLE"),
        "author": get_env_or_exit("PR_AUTHOR"),
        "author_avatar": os.environ.get("PR_AUTHOR_AVATAR", ""),
        "url": get_env_or_exit("PR_URL"),
        "number": os.environ.get("PR_NUMBER", "N/A"),
        "labels": os.environ.get("PR_LABELS", ""),
        "body": os.environ.get("PR_BODY", "").strip()[:500],
        "repo": os.environ.get("PR_REPO", "RatLoopz/sahidawa-india"),
        "lines_changed": os.environ.get("PR_LINES_CHANGED", "0"),
        "diff": os.environ.get("PR_GIT_DIFF", ""),
    }


def determine_tier(labels_str: str) -> tuple:
    labels = [lbl.strip().lower() for lbl in labels_str.split(",")]
    for label in ["level:critical", "level:advanced"]:
        if label in labels:
            return LABEL_TIER_MAP[label]
    return ("🔥 Advanced-Level", "highly complex")


def validate_pr_size(pr: dict) -> None:
    """
    Validates if the PR is substantial enough to warrant a shoutout.
    - level:critical requires at least 300 lines changed.
    - level:advanced requires at least 200 lines changed.
    """
    labels = [lbl.strip().lower() for lbl in pr["labels"].split(",")]
    try:
        lines_changed = int(pr["lines_changed"])
    except ValueError:
        lines_changed = 0

    is_critical = "level:critical" in labels
    is_advanced = "level:advanced" in labels

    # If somehow both or neither are there, default to advanced threshold
    threshold = 300 if is_critical else 200
    tier_name = "Critical" if is_critical else "Advanced"

    if lines_changed < threshold:
        print(f"🛑 REJECTED: PR only changed {lines_changed} lines.")
        print(f"   {tier_name} shoutouts require at least {threshold} lines of code changes.")
        print("   Exiting gracefully without triggering Make.com webhook or consuming AI credits.")
        sys.exit(0)
    
    print(f"✅ PR Size Validation Passed. Lines changed: {lines_changed} (Threshold: {threshold})")


def is_dummy_linkedin_url(url: str) -> bool:
    if not url:
        return True
    url_lower = url.lower()
    dummy_keywords = [
        "dipexplorer-final-official-github-test",
        "github-test",
        "your-username",
        "your_username",
        "username-here",
        "example",
        "placeholder",
        "mock-username"
    ]
    for keyword in dummy_keywords:
        if keyword in url_lower:
            return True
            
    # Check if the username segment in the path is generic or matches placeholder terms
    match = re.search(r'/in/([^/?#]+)', url)
    if match:
        username = match.group(1).lower()
        if username in ["username", "yourusername", "your-username", "your_username", "contributor"]:
            return True
    return False


def extract_linkedin_url(body: str) -> str:
    # Requires a format like "LinkedIn: https://linkedin.com/in/username" 
    # to avoid accidentally extracting a random link from the PR body.
    match = re.search(r'(?i)LinkedIn(?: Profile(?: URL)?)?:\s*(https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+)', body)
    if match:
        url = match.group(1)
        if not is_dummy_linkedin_url(url):
            return url
        else:
            print(f"⚠️ Ignored dummy/placeholder LinkedIn URL in PR body: {url}")
    return ""


def check_if_commented(pr_number: str, comment_snippet: str) -> bool:
    import subprocess
    try:
        result = subprocess.run(
            ['gh', 'pr', 'view', pr_number, '--json', 'comments'], 
            capture_output=True, text=True
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            for c in data.get("comments", []):
                if comment_snippet in c.get("body", ""):
                    return True
    except Exception as e:
        print(f"Failed to check comments: {e}")
    return False


def fetch_linkedin_from_github_profile(username: str) -> str:
    token = os.environ.get("GH_TOKEN", "")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    url = f"https://api.github.com/users/{username}/social_accounts"
    try:
        print(f"🔍 Checking GitHub profile social accounts for @{username}...")
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            accounts = resp.json()
            for account in accounts:
                if account.get("provider") == "linkedin":
                    linkedin_url = account.get("url", "").strip()
                    if linkedin_url and not is_dummy_linkedin_url(linkedin_url):
                        print(f"✅ Found LinkedIn URL on GitHub profile: {linkedin_url}")
                        return linkedin_url
                    elif linkedin_url:
                        print(f"⚠️ Ignored dummy/placeholder LinkedIn URL on GitHub profile: {linkedin_url}")
        else:
            print(f"⚠️ GitHub Social Accounts API returned status: {resp.status_code}")
    except Exception as e:
        print(f"⚠️ Failed to fetch GitHub social accounts: {e}")
    return ""


def validate_linkedin_url(pr: dict) -> str:
    # 1. First try to fetch LinkedIn link dynamically from contributor's GitHub social accounts
    linkedin_url = fetch_linkedin_from_github_profile(pr["author"])
    
    # 2. Fallback to PR description if not set on GitHub profile
    if not linkedin_url:
        print("🔍 LinkedIn URL not found on GitHub profile. Checking PR description...")
        linkedin_url = extract_linkedin_url(pr.get("body", ""))
        
    if not linkedin_url:
        print("🛑 REJECTED: No LinkedIn Profile URL found in GitHub profile or PR description.")
        print("   Without a LinkedIn URL, we cannot properly tag/mention the contributor.")
        print("   Exiting gracefully without triggering Make.com webhook.")
        
        pr_number = pr.get("number")
        if pr_number and pr_number != "N/A":
            comment_snippet = "Your PR is approved for a LinkedIn shoutout!"
            comment_text = (
                f"👋 {comment_snippet}\n"
                f"To get featured, please add your LinkedIn ID to your GitHub profile social links, "
                f"or to the PR description like this:\n"
                f"`LinkedIn: https://linkedin.com/in/your-username`\n\n"
                f"Follow our page to ensure you get properly tagged: https://www.linkedin.com/company/ratloopz/"
            )
            if not check_if_commented(pr_number, comment_snippet):
                import subprocess
                subprocess.run(['gh', 'pr', 'comment', pr_number, '--body', comment_text])
        
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a") as f:
                f.write("shoutout_status=skipped\n")
        
        sys.exit(0)
        
    print(f"✅ Found LinkedIn URL: {linkedin_url}")
    return linkedin_url


def evaluate_pr_impact(pr: dict) -> None:
    """
    Sends the PR diff to Gemini to semantically evaluate if it's a genuine 
    advanced/critical contribution, or just trivial bloat (JSON dumps, locks).
    """
    gemini_api_key = get_env_or_exit("GEMINI_API_KEY")
    diff = pr.get("diff", "")
    
    if not diff or diff == "Diff unavailable":
        print("⚠️  No Git Diff available. Bypassing semantic AI check.")
        return

    print("🧠 Semantic AI Gatekeeper: Evaluating PR quality...")

    system_prompt = (
        "You are an expert Principal Engineer. Your job is to evaluate if a Pull Request "
        "diff represents a genuinely complex/architectural contribution, or if it is "
        "trivial bloat (e.g. large JSON data dumps, package-lock.json updates, simple "
        "variable renaming across many files, or auto-generated code).\n"
        "Reply STRICTLY with exactly one word: APPROVE or REJECT."
    )

    user_prompt = (
        f"PR Title: {pr['title']}\n\n"
        f"Git Diff:\n{diff[:50000]}" # Limit context to 50k chars
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={gemini_api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 10},
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }

    try:
        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
        resp.raise_for_status()
        resp_json = resp.json()
        
        candidates = resp_json.get("candidates", [])
        if not candidates:
            raise KeyError("No candidates returned from Gemini API")
            
        candidate = candidates[0]
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        if not parts:
            finish_reason = candidate.get("finishReason")
            raise KeyError("No content parts returned. Missing or invalid finishReason.")
            
        verdict = parts[0].get("text", "").strip().upper()
        
        if "REJECT" in verdict:
            print(f"🛑 AI GATEKEEPER REJECTED: This PR appears to be trivial/bloat despite its size.")
            print("   Verdict received: REJECTED")
            print("   Exiting gracefully to prevent a fake shoutout.")
            sys.exit(0)
            
        print("✅ AI Gatekeeper Approved: PR is a genuine contribution.")
        
    except Exception as exc:
        print(f"⚠️  AI Gatekeeper evaluation failed ({str(exc).replace(gemini_api_key, '***')}). Bypassing semantic check.")


def get_contributor_name(github_username: str) -> str:
    """Fetch actual full name from GitHub, fallback to parsed username."""
    token = os.environ.get("GH_TOKEN", "")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    try:
        url = f"https://api.github.com/users/{github_username}"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            name = resp.json().get("name")
            if name and name.strip():
                return name.strip()
    except Exception as e:
        print(f"⚠️ Failed to fetch GitHub name: {e}")

    # Fallback: Strip trailing numbers/suffixes, split on - or _ and capitalize first part
    parts = re.split(r'[-_]', github_username)
    if parts:
        name = re.sub(r'\d+$', '', parts[0])
        if name:
            return name.capitalize()
    return github_username


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Generate post with Gemini AI (Dynamic content)
# ─────────────────────────────────────────────────────────────────────────────
def generate_post_with_gemini(pr: dict, tier_display: str, tier_desc: str) -> str:
    """
    Calls Gemini 2.5 Flash to produce a unique, human-sounding LinkedIn post.
    High temperature = different text on every PR merge.
    Falls back to static template if API unavailable.
    """
    gemini_api_key = get_env_or_exit("GEMINI_API_KEY")
    contributor_name = get_contributor_name(pr['author'])

    system_prompt = (
        f"You are the core maintainer of '{PROJECT_NAME}'. "
        "Write a short, heartfelt, and genuine LinkedIn post thanking a contributor. "
        "It MUST sound like a real human engineer expressing sincere gratitude from the heart. "
        "Do not use corporate buzzwords. Keep it concise, high-quality, and impactful. "
        "Use minimal formatting and very few emojis. It should feel like a personal shoutout, not a bot. "
        "Never start with 'I am' or 'We are'. "
        "IMPORTANT: Do NOT use @github-username style mentions — this is a LinkedIn post and GitHub handles "
        "don't work as LinkedIn tags. Instead refer to the person by their first name."
    )

    user_prompt = (
        f"Write a short, genuine LinkedIn shoutout for this contributor:\n\n"
        f"Contributor first name: {contributor_name} (GitHub: @{pr['author']}, LinkedIn: {pr['linkedin_url']})\n"
        f"PR Title: {pr['title']}\n"
        f"PR Number: #{pr['number']}\n"
        f"Tier: {tier_display}\n"
        f"PR Link: {pr['url']}\n"
        f"Project: {PROJECT_NAME} — {PROJECT_TAGLINE}\n"
        f"PR Description: {pr['body'] if pr['body'] else 'Not provided'}\n\n"
        f"### Technical Context (Use this to explain their impact) ###\n"
        f"{pr['diff'][:15000] if pr.get('diff') else 'No diff provided.'}\n\n"
        f"CRITICAL REQUIREMENTS:\n"
        f"1. Start by directly thanking {contributor_name} by their first name in a warm, personal way. "
        f"Do NOT use @{pr['author']} (GitHub handle) — LinkedIn won't recognize it. Do NOT put their LinkedIn link in the very first sentence.\n"
        f"2. Look at the Technical Context (the code diff) and briefly summarize the technical impact they made. Make them feel proud.\n"
        f"3. Make them feel truly valued. Tell them their hard work is making a real difference. Motivate them.\n"
        f"4. Include their LinkedIn profile link near the bottom of the post in a line like: 'Connect with {contributor_name}: {pr['linkedin_url']}'\n"
        f"5. End by warmly welcoming new developers to join the journey (GSSoC2026), with the repo link: {PROJECT_GITHUB_URL}\n"
        f"6. Keep the text complete and easy to read. Do NOT use heavy bullet points, bolding, or too many emojis.\n"
        f"7. Do NOT include hashtags at the end (they are added automatically later). "
        f"8. IMPORTANT: Write a COMPLETE post. Do not cut off mid-sentence."
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={gemini_api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 800},
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }

    import time
    
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            print(f"🤖 Calling Gemini AI to generate post... (Attempt {attempt}/{max_retries})")
            resp = requests.post(url, headers={"Content-Type": "application/json"},
                                 json=payload, timeout=30)
            
            if resp.status_code == 429:
                print(f"⏳ Rate limit hit (429). Retrying in 20 seconds...")
                time.sleep(20)
                continue
                
            resp.raise_for_status()
            resp_json = resp.json()
            
            candidates = resp_json.get("candidates", [])
            if not candidates:
                raise KeyError("No candidates returned from Gemini API")
                
            candidate = candidates[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            if not parts:
                finish_reason = candidate.get("finishReason")
                raise KeyError("No content parts returned. Missing or invalid finishReason.")
                
            text = parts[0].get("text", "").strip()
            
            # Validate the response is actually complete and not truncated
            if len(text) < 100:
                print(f"⚠️ Gemini returned suspiciously short content ({len(text)} chars). Using static fallback.")
                return _static_fallback(pr, tier_display)
            
            # Check if the post ends mid-sentence (sign of truncation)
            finish_reason = candidate.get("finishReason", "")
            if finish_reason not in ("STOP", "stop", "") and finish_reason is not None:
                print("⚠️ Gemini finished with an incomplete reason (not STOP). Using static fallback.")
                return _static_fallback(pr, tier_display)
            
            print("\n✅ Script completed successfully!")
            print("✅ Gemini post generated successfully.")
            return text
            
        except Exception as exc:
            if attempt == max_retries:
                print(f"⚠️  Gemini AI failed after {max_retries} attempts ({str(exc).replace(gemini_api_key, '***')}). Using static fallback.")
                return _static_fallback(pr, tier_display)
            print(f"⚠️  Gemini AI failed ({str(exc).replace(gemini_api_key, '***')}). Retrying in 10 seconds...")
            time.sleep(10)
            
    return _static_fallback(pr, tier_display)


def _static_fallback(pr: dict, tier_display: str) -> str:
    """
    Generates a highly dynamic, heartfelt, and professional appreciation post
    when the Gemini AI API hits its daily free-tier quota (429) or returns incomplete content.
    Deterministically rotates between distinct human-written layout formats.
    Note: Uses contributor's actual name, NOT @github-handle (LinkedIn doesn't support GitHub mentions).
    """
    contributor_name = get_contributor_name(pr['author'])
    
    templates = [
        # Template 1: Focus on impact
        (
            "A huge shoutout to {name} for landing an outstanding {tier_display} contribution! 🚀\n\n"
            "They just merged PR #{number}: \"{title}\". This optimization/feature represents significant engineering effort "
            "and makes a direct impact on {project_name}'s mission to build India's open-source medicine safety platform. "
            "We are incredibly grateful for your time, skill, and dedication to the community. Keep up the amazing work!\n\n"
            "Connect with {name}: {linkedin_url}\n\n"
            "If you're inspired and want to build for India's digital health infrastructure, join us in GSSoC 2026! 🇮🇳\n\n"
            "Explore the repository: {github_url}\n"
            "View the contribution: {pr_url}"
        ),
        # Template 2: Heartfelt thank you
        (
            "Huge congratulations and thanks to {name}! 🎉\n\n"
            "Their merged PR #{number} (\"{title}\") is a major addition to {project_name}. "
            "Tackling {tier_desc} engineering challenges takes true developer craftsmanship, and {name}'s work is a stellar example. "
            "Thank you for helping us make medicine safety accessible to 1.4 billion Indians. We are thrilled to have you in our contributor community!\n\n"
            "Connect with {name}: {linkedin_url}\n\n"
            "Ready to make a difference? GSSoC 2026 contributors are actively scaling {project_name}. Jump in now!\n\n"
            "GitHub Repository: {github_url}\n"
            "Check out the PR: {pr_url}"
        ),
        # Template 3: Direct community welcome
        (
            "Let's celebrate another landmark contribution by {name}! 🌟\n\n"
            "With PR #{number} (\"{title}\"), they tackled a {tier_display} task with exceptional skill. "
            "Every line of code merged brings {project_name} closer to securing medicine health tracking for everyone. "
            "Your hard work is deeply appreciated by the core maintainers. Keep shining and coding!\n\n"
            "Connect with {name}: {linkedin_url}\n\n"
            "Want to contribute to India's open-source stack? Join the GSSoC 2026 wave on our repo:\n\n"
            "Codebase: {github_url}\n"
            "Merged PR: {pr_url}"
        )
    ]
    
    # Deterministic rotation based on PR number to give variation
    try:
        pr_idx = int(pr.get("number", "0")) % len(templates)
    except Exception:
        pr_idx = 0
        
    selected_template = templates[pr_idx]
    
    labels = pr["labels"].lower()
    tier_desc = "mission-critical" if "level:critical" in labels else "highly complex"
    
    return selected_template.format(
        name=contributor_name,
        linkedin_url=pr['linkedin_url'],
        tier_display=tier_display,
        tier_desc=tier_desc,
        number=pr['number'],
        title=pr['title'],
        project_name=PROJECT_NAME,
        github_url=PROJECT_GITHUB_URL,
        pr_url=pr['url']
    )


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Assemble final post (Dynamic body + Static branding)
# ─────────────────────────────────────────────────────────────────────────────
def assemble_final_post(ai_content: str, pr: dict) -> str:
    clean = re.sub(r"\n{3,}", "\n\n", ai_content).strip()
    return (
        f"{clean}\n\n"
        f"─────────────────────\n"
        f"{PROJECT_HASHTAGS}"
    )


def crop_and_upload_og_image(pr: dict) -> str:
    fallback_url = f"https://opengraph.githubassets.com/1/{pr['repo']}/pull/{pr['number']}"
    try:
        from PIL import Image
        from io import BytesIO
        
        print(f"📥 Downloading GitHub OG image: {fallback_url}")
        res = requests.get(fallback_url, timeout=15)
        if res.status_code != 200:
            print(f"⚠️ Failed to download GitHub OG image. Code: {res.status_code}. Using uncropped URL.")
            return fallback_url
            
        img = Image.open(BytesIO(res.content))
        w, h = img.size
        print(f"📏 Original image size: {w}x{h}")
        
        # Crop the bottom 24 pixels (the colored language bar)
        cropped_img = img.crop((0, 0, w, h - 24))
        
        img_buffer = BytesIO()
        cropped_img.save(img_buffer, "PNG")
        img_data = img_buffer.getvalue()
        
        # Upload to Catbox
        print("📤 Uploading cropped image to Catbox...")
        try:
            files = {
                'reqtype': (None, 'fileupload'),
                'fileToUpload': ('shoutout.png', img_data, 'image/png')
            }
            res = requests.post('https://catbox.moe/user/api.php', files=files, timeout=15)
            if res.status_code == 200 and "files.catbox.moe" in res.text:
                uploaded_url = res.text.strip()
                print(f"✅ Successfully uploaded to Catbox: {uploaded_url}")
                return uploaded_url
        except Exception as ce:
            print(f"⚠️ Catbox upload failed ({ce}). Trying tmpfiles.org fallback...")

        # Upload to tmpfiles.org
        try:
            files = {
                'file': ('shoutout.png', img_data, 'image/png')
            }
            res = requests.post('https://tmpfiles.org/api/v1/upload', files=files, timeout=15)
            if res.status_code == 200:
                json_resp = res.json()
                if json_resp.get("status") == "success":
                    raw_url = json_resp["data"]["url"]
                    uploaded_url = raw_url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/")
                    print(f"✅ Successfully uploaded to tmpfiles.org: {uploaded_url}")
                    return uploaded_url
        except Exception as te:
            print(f"⚠️ tmpfiles.org upload failed ({te})")
            
    except Exception as e:
        print(f"⚠️ Image crop/upload process failed: {e}. Using uncropped URL.")
        
    return fallback_url


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Send to Make.com Webhook (Make posts to LinkedIn Company Page)
# ─────────────────────────────────────────────────────────────────────────────
def send_to_make_webhook(post_text: str, pr: dict) -> None:
    """
    Sends a JSON payload to Make.com webhook.
    Make.com handles the LinkedIn Company Page posting — no Advertising API needed.

    Payload fields Make.com will receive:
      - post_text   : Full formatted LinkedIn post
      - pr_title    : PR title (for Make filters/conditions if needed)
      - pr_author   : Contributor GitHub username
      - pr_url      : Direct link to the PR
      - pr_number   : PR number
      - tier        : "level:advanced" or "level:critical"
      - author_avatar : URL to contributor's GitHub avatar
    """
    webhook_url = get_env_or_exit("MAKE_WEBHOOK_URL")

    labels = pr["labels"].lower()
    tier = "level:critical" if "level:critical" in labels else "level:advanced"

    # Crop and upload GitHub OG image (removing bottom language bar)
    image_url = crop_and_upload_og_image(pr)
    
    payload = {
        "post_text": post_text,
        "text": post_text,
        "commentary": post_text,
        "description": post_text,
        "message": post_text,
        "content": post_text,
        "pr_title": pr["title"],
        "pr_author": pr["author"],
        "author_avatar": pr.get("author_avatar", ""),
        "image_url": image_url,
        "image": image_url,
        "imageUrl": image_url,
        "pr_url": pr["url"],
        "pr_number": pr["number"],
        "tier": tier,
    }

    if "dry-run" in webhook_url.lower() or "mock" in webhook_url.lower():
        print("🧪 Dry-run/Mock webhook URL detected. Skipping actual HTTP request to Make.com.")
        print("Payload data omitted for security.")
        return

    print("📤 Sending post to Make.com webhook...")
    print(f"   Webhook: {webhook_url[:15]}***")
    resp = requests.post(
        webhook_url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )

    if resp.status_code == 200 and resp.text.strip().lower() == "accepted":
        print("✅ Make.com accepted the payload — LinkedIn post will be published.")
    elif resp.status_code == 200:
        print(f"✅ Make.com responded 200: {resp.text[:100]}")
    else:
        print(f"❌ Make.com webhook error: {resp.status_code} — {resp.text}")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  SahiDawa LinkedIn Shoutout Bot (via Make.com)")
    print("=" * 60)

    pr = get_pr_metadata()
    print(f"\n📋 PR Details:")
    print(f"   Title  : {pr['title']}")
    print(f"   Author : @{pr['author']}")
    print(f"   Number : #{pr['number']}")
    print(f"   Labels : {pr['labels']}")
    print(f"   URL    : {pr['url']}")
    print(f"   Lines  : {pr['lines_changed']}\n")

    tier_display, tier_desc = determine_tier(pr["labels"])
    print(f"🏆 Tier: {tier_display}")

    # Check for LinkedIn Profile Link
    pr["linkedin_url"] = validate_linkedin_url(pr)

    # The Smart Gate Validations
    validate_pr_size(pr)
    evaluate_pr_impact(pr)

    ai_content = generate_post_with_gemini(pr, tier_display, tier_desc)
    final_post = assemble_final_post(ai_content, pr)

    print("\n" + "─" * 60)
    print("📝 FINAL POST PREVIEW:")
    print("─" * 60)
    print("<Final post preview omitted for security>")
    print("─" * 60 + "\n")

    send_to_make_webhook(final_post, pr)
    
    # Final Output Step
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write("shoutout_status=published\n")
            
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
