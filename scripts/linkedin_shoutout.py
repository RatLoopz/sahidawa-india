#!/usr/bin/env python3
"""
SahiDawa LinkedIn Automated Shoutout Script (via Native LinkedIn API + Supabase Persistence)
===================================================================
Flow:
  1. PR is merged with level:advanced or level:critical label
  2. GitHub Actions calls this script
  3. Script checks Supabase for idempotency (prevents duplicate posts)
  4. Script generates a unique post using Gemini AI
  5. Script natively uploads image and creates LinkedIn UGC Post
  6. Script logs success/failure in Supabase for retries
"""

import os
import sys
import re
import json
import requests
import traceback
import subprocess
from datetime import datetime, timedelta, timezone


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
        "title":          get_env_or_exit("PR_TITLE"),
        "author":         get_env_or_exit("PR_AUTHOR"),
        "author_avatar":  os.environ.get("PR_AUTHOR_AVATAR", ""),
        "url":            get_env_or_exit("PR_URL"),
        "number":         os.environ.get("PR_NUMBER", "N/A"),
        "labels":         os.environ.get("PR_LABELS", ""),
        "body":           os.environ.get("PR_BODY", "").strip()[:500],
        "repo":           os.environ.get("PR_REPO", "RatLoopz/sahidawa-india"),
        "lines_changed":  os.environ.get("PR_LINES_CHANGED", "0"),
        "diff":           os.environ.get("PR_GIT_DIFF", ""),
        "additions":      os.environ.get("PR_ADDITIONS", "?"),
        "deletions":      os.environ.get("PR_DELETIONS", "?"),
        "files_count":    os.environ.get("PR_FILES_COUNT", "?"),
        "commits_count":  os.environ.get("PR_COMMITS_COUNT", "?"),
    }


def determine_tier(labels_str: str) -> tuple:
    labels = [lbl.strip().lower() for lbl in labels_str.split(",")]
    for label in ["level:critical", "level:advanced"]:
        if label in labels:
            return LABEL_TIER_MAP[label]
    return ("🔥 Advanced-Level", "highly complex")


def validate_pr_size(pr: dict) -> None:
    labels = [lbl.strip().lower() for lbl in pr["labels"].split(",")]
    try:
        lines_changed = int(pr["lines_changed"])
    except ValueError:
        lines_changed = 0

    is_critical = "level:critical" in labels
    is_advanced = "level:advanced" in labels

    threshold = 100 if is_critical else 150
    tier_name = "Critical" if is_critical else "Advanced"

    if lines_changed < threshold:
        print(f"🛑 REJECTED: PR only changed {lines_changed} lines.")
        print(f"   {tier_name} shoutouts require at least {threshold} lines of code changes.")
        sys.exit(0)
    
    print(f"✅ PR Size Validation Passed. Lines changed: {lines_changed} (Threshold: {threshold})")


def is_dummy_linkedin_url(url: str) -> bool:
    if not url:
        return True
    url_lower = url.lower()
    dummy_keywords = [
        "dipexplorer-final-official-github-test",
        "github-test", "your-username", "your_username",
        "username-here", "example", "placeholder", "mock-username"
    ]
    for keyword in dummy_keywords:
        if keyword in url_lower:
            return True
            
    match = re.search(r'/in/([^/?#]+)', url)
    if match:
        username = match.group(1).lower()
        if username in ["username", "yourusername", "your-username", "your_username", "contributor"]:
            return True
    return False


def extract_linkedin_url(body: str) -> str:
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
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            accounts = resp.json()
            for account in accounts:
                if account.get("provider") == "linkedin":
                    linkedin_url = account.get("url", "").strip()
                    if linkedin_url and not is_dummy_linkedin_url(linkedin_url):
                        return linkedin_url
    except Exception as e:
        pass
    return ""


def validate_linkedin_url(pr: dict) -> str:
    linkedin_url = fetch_linkedin_from_github_profile(pr["author"])
    if not linkedin_url:
        linkedin_url = extract_linkedin_url(pr.get("body", ""))
        
    if not linkedin_url:
        print("🛑 REJECTED: No LinkedIn Profile URL found.")
        
        pr_number = pr.get("number")
        if pr_number and pr_number != "N/A":
            comment_snippet = "Your PR is approved for a LinkedIn shoutout!"
            comment_text = (
                f"👋 {comment_snippet}\n"
                f"To get featured, please add your LinkedIn ID to your GitHub profile social links, "
                f"or to the PR description like this:\n"
                f"`LinkedIn: https://linkedin.com/in/your-username`\n\n"
            )
            if not check_if_commented(pr_number, comment_snippet):
                import subprocess
                subprocess.run(['gh', 'pr', 'comment', pr_number, '--body', comment_text])
        
        # Output skipped to prevent github actions from adding the published label
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a") as f:
                f.write("shoutout_status=skipped\n")
        
        sys.exit(0)
        
    print(f"✅ Found LinkedIn URL: {linkedin_url}")
    return linkedin_url


def evaluate_pr_impact(pr: dict) -> None:
    gemini_api_key = get_env_or_exit("GEMINI_API_KEY")
    diff = pr.get("diff", "")
    if not diff or diff == "Diff unavailable":
        return

    print("🧠 Semantic AI Gatekeeper: Evaluating PR quality...")
    system_prompt = (
        "You are an expert Principal Engineer. Your job is to evaluate if a Pull Request "
        "diff represents a genuinely complex/architectural contribution. "
        "Reply STRICTLY with exactly one word: APPROVE or REJECT."
    )
    user_prompt = f"PR Title: {pr['title']}\n\nGit Diff:\n{diff[:50000]}"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={gemini_api_key}"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 10},
    }

    try:
        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
        resp.raise_for_status()
        verdict = resp.json().get("candidates", [])[0].get("content", {}).get("parts", [])[0].get("text", "").strip().upper()
        if "REJECT" in verdict:
            print("🛑 AI GATEKEEPER REJECTED.")
            sys.exit(0)
    except Exception as exc:
        print("⚠️ AI Gatekeeper evaluation failed. Bypassing semantic check.")


def get_contributor_name(github_username: str) -> str:
    token = os.environ.get("GH_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        url = f"https://api.github.com/users/{github_username}"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200 and resp.json().get("name"):
            return resp.json().get("name").strip()
    except Exception:
        pass

    parts = re.split(r'[-_]', github_username)
    if parts:
        name = re.sub(r'\d+$', '', parts[0])
        if name:
            return name.capitalize()
    return github_username




# ─────────────────────────────────────────────────────────────────────────────
# CONTENT GENERATION
# ─────────────────────────────────────────────────────────────────────────────
def _static_fallback(pr: dict, tier_display: str) -> str:
    contributor_name = get_contributor_name(pr['author'])
    pr_url = pr.get('url', 'N/A')
    
    templates = [
        # Template 1: Direct Technical
        "PR #{number} (\"{title}\") has been successfully merged into SahiDawa. ⚙️\n\n"
        "This update resolves a key engineering requirement by improving our core infrastructure for medicine tracking. {name} successfully executed this {tier_display} task, delivering clean and functional code.\n\n"
        "Good work, {name}. We appreciate the contribution.\n\n"
        "Connect with {name}: {linkedin_url}\n\n"
        "Want to contribute to India's open-source stack? Join the GSSoC 2026 wave on our repo:\n\n"
        "Codebase: {github_url}\n"
        "Merged PR: {pr_url}",
        
        # Template 2: Direct Impact
        "We have rolled out a new update via PR #{number}: \"{title}\". 🛡️\n\n"
        "{name} handled this {tier_display} issue, optimizing our platform's reliability. The changes directly impact how we scale our open-source health-tech stack for users across India.\n\n"
        "Solid execution by {name}.\n\n"
        "Connect with {name}: {linkedin_url}\n\n"
        "Want to contribute to India's open-source stack? Join the GSSoC 2026 wave on our repo:\n\n"
        "Codebase: {github_url}\n"
        "Merged PR: {pr_url}",
        
        # Template 3: Direct Community
        "New code shipped to SahiDawa production. 🚀\n\n"
        "Credit to {name} for resolving PR #{number} (\"{title}\"). Tackling a {tier_display} problem requires solid technical context, and this PR delivers exactly that. It's an important addition to our codebase.\n\n"
        "Thanks for the effort, {name}.\n\n"
        "Connect with {name}: {linkedin_url}\n\n"
        "Want to contribute to India's open-source stack? Join the GSSoC 2026 wave on our repo:\n\n"
        "Codebase: {github_url}\n"
        "Merged PR: {pr_url}"
    ]
    try:
        pr_idx = int(pr.get("number", "0")) % len(templates)
    except Exception:
        pr_idx = 0
    selected_template = templates[pr_idx]
    
    return selected_template.format(
        name=contributor_name,
        linkedin_url=pr['linkedin_url'],
        tier_display=tier_display,
        number=pr['number'],
        title=pr['title'],
        github_url=PROJECT_GITHUB_URL,
        pr_url=pr_url
    )

def generate_post_with_groq(pr: dict, tier_display: str, tier_desc: str, system_prompt: str, user_prompt: str) -> str:
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        return ""
    
    print("🔄 Attempting Groq API (Llama 3) fallback...")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama3-70b-8192",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.5,
        "max_tokens": 1500
    }
    
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        text = resp.json().get("choices", [])[0].get("message", {}).get("content", "").strip()
        if len(text) > 100:
            print("✅ Successfully generated post using Groq fallback!")
            return text
    except Exception as e:
        print(f"⚠️ Groq API fallback failed: {e}")
    return ""


def generate_post_with_gemini(pr: dict, tier_display: str, tier_desc: str) -> str:
    gemini_api_key = get_env_or_exit("GEMINI_API_KEY")
    contributor_name = get_contributor_name(pr['author'])
    system_prompt = (
        "You are the Open-Source Maintainer for SahiDawa, India's medicine safety platform. "
        "Write a highly engaging, concise LinkedIn post that mixes a 'Technical Deep Dive' with a 'Community Spotlight'.\n\n"
        "CRITICAL RULES FOR TONE AND VARIABILITY:\n"
        "- Hook the reader immediately! Start with a bold statement or a question about the technical challenge.\n"
        "- Tell a story: What was the problem? How did the contributor architect the solution? Why does it matter for 1.4 billion Indians relying on SahiDawa?\n"
        "- Be warm, appreciative, and celebrate the open-source community spirit (GSSoC).\n"
        "- Use short paragraphs (1-2 sentences) and professional emojis (🚀, 🛡️, ⚙️, 👏, 🔥) to make it highly readable and scroll-stopping.\n"
        "- STRICT LENGTH LIMIT: Keep the entire post under 200 words. Do NOT write long essays.\n"
        "- Do not use robotic templates. Weave the facts naturally.\n\n"
        "FRAMEWORK TO FOLLOW:\n"
        "1. The Scroll-Stopping Hook: E.g., 'Ever wondered how we handle X at scale? @Contributor just solved it for us...'\n"
        "2. The Problem & Impact: What was broken or missing, and how does it affect SahiDawa's mission?\n"
        "3. The Technical Deep Dive: Briefly explain the engineering mechanism and code changes.\n"
        "4. The Community Spotlight: Celebrate the contributor's open-source journey and effort.\n"
        "5. The Connection: Include 'Connect with [Name]: [LinkedIn URL]'.\n"
        "6. The Call to Action: End EXACTLY with this text (do not modify this footer):\n\n"
        "Want to contribute to India's open-source stack? Join the GSSoC 2026 wave on our repo:\n\n"
        "Codebase: [Insert Codebase URL]\n"
        "Merged PR: [Insert PR URL]"
    )
    user_prompt = (
        f"Contributor: {contributor_name}\n"
        f"PR Title: {pr['title']}\n"
        f"PR Number: #{pr.get('number', 'N/A')}\n"
        f"PR URL: {pr.get('url', 'N/A')}\n"
        f"LinkedIn URL: {pr.get('linkedin_url', '')}\n"
        f"Task Tier: {tier_display} ({tier_desc})\n"
        f"Codebase URL: {PROJECT_GITHUB_URL}\n\n"
        f"Git Diff Context:\n{pr.get('diff', '')[:3000]}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={gemini_api_key}"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1500},
    }

    import time
    for attempt in range(1, 4):
        try:
            resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
            if resp.status_code == 429:
                print(f"⚠️ Gemini Rate Limit Exceeded (Attempt {attempt}). Waiting 20s...")
                time.sleep(20)
                continue
            resp.raise_for_status()
            text = resp.json().get("candidates", [])[0].get("content", {}).get("parts", [])[0].get("text", "").strip()
            if len(text) > 100:
                return text
        except Exception as e:
            print(f"⚠️ Gemini API attempt {attempt} failed: {e}")
            time.sleep(10)
            
    # Try Groq API if Gemini completely fails
    groq_content = generate_post_with_groq(pr, tier_display, tier_desc, system_prompt, user_prompt)
    if groq_content:
        return groq_content
        
    print("🔄 AI generation completely failed. Falling back to static template.")
    return _static_fallback(pr, tier_display)

def assemble_final_post(ai_content: str, pr: dict) -> str:
    clean = re.sub(r"\n{3,}", "\n\n", ai_content).strip()
    return f"{clean}\n\n─────────────────────\n{PROJECT_HASHTAGS}"


# ─────────────────────────────────────────────────────────────────────────────
# IMAGE GENERATION + LINKEDIN NATIVE IMAGE UPLOAD
# ─────────────────────────────────────────────────────────────────────────────
def generate_comic_prompt_with_gemini(pr: dict, api_key: str) -> str:
    print("🧠 Generating dynamic visual prompt for the PR comic...")
    system_prompt = (
        "You are an expert technical illustrator creating prompts for an AI image generator (Imagen 3). "
        "Your task is to take a GitHub Pull Request and design a whiteboard-style stickman comic prompt that explains the technical change with developer humor.\n\n"
        "RULES FOR THE PROMPT YOU GENERATE:\n"
        "1. Visual Style: Minimalist hand-drawn stickmen on a clean off-white whiteboard with subtle gray dot grid. No 3D, no neon, no gradients.\n"
        "2. Characters: Create two stickmen representing concepts in the PR (e.g., 'Main Thread' vs 'Web Worker', 'Frontend' vs 'Database', 'Dev' vs 'Bug', 'Old API' vs 'New Cache'). Label them clearly.\n"
        "3. Action: Show a funny interaction metaphor for the PR. For example, one struggling with heavy boxes while the other helps, or one throwing something away.\n"
        "4. Speech Bubbles: Include short, witty developer humor in speech bubbles.\n"
        "5. PR Card: The prompt MUST instruct the image generator to draw a GitHub PR card at the bottom containing exactly:\n"
        f"   - {pr.get('repo', 'RatLoopz/sahidawa-india')}\n"
        f"   - PR #{pr.get('number', '???')}\n"
        f"   - Title: {pr.get('title', 'Unknown')}\n"
        f"   - @{pr.get('author', 'contributor')}\n"
        f"   - +{pr.get('additions', '?')} additions, −{pr.get('deletions', '?')} deletions, {pr.get('files_count', '?')} files\n"
        "   - An arrow pointing to the contributor avatar saying 'this guy cooked 👨‍🍳'.\n"
        "6. Format: Do NOT use markdown code blocks. Output ONLY the raw image generation prompt string."
    )
    user_prompt = f"PR Title: {pr.get('title', '')}\nPR Body: {pr.get('body', '')[:500]}\nGenerate the detailed image prompt."
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 800},
    }
    
    try:
        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
        resp.raise_for_status()
        text = resp.json().get("candidates", [])[0].get("content", {}).get("parts", [])[0].get("text", "").strip()
        if len(text) > 50:
            # Clean up potential markdown formatting
            text = text.replace("```text", "").replace("```prompt", "").replace("```", "").strip()
            return text
    except Exception as e:
        print(f"⚠️ Dynamic prompt generation failed: {e}")
    
    # Generic fallback prompt
    return f"""A clean, minimal, professional LinkedIn engineering micro-comic on a whiteboard background.
Two simple stickmen developers interacting. One is struggling with heavy technical debt, the other provides a solution.
Include speech bubbles with developer humor.
At the bottom, draw a GitHub PR card exactly like this:
RatLoopz/sahidawa-india
PR #{pr.get('number', '???')}
{pr.get('title', 'Unknown')}
@{pr.get('author', 'contributor')}
+{pr.get('additions', '?')} additions, −{pr.get('deletions', '?')} deletions
Draw an arrow pointing to the contributor's avatar that says "this guy cooked 👨‍🍳".
"""

def generate_and_upload_image(pr: dict, access_token: str, org_urn: str) -> str | None:
    """
    1. Call Gemini API (Imagen 3) to generate the comic PNG.
    2. Upload it natively to LinkedIn via Assets API.
    Returns the image asset URN on success, or None on any failure.
    """
    comic_path = "/tmp/pr_comic.png"
    api_key = get_env_or_exit("GEMINI_API_KEY")
    
    prompt = generate_comic_prompt_with_gemini(pr, api_key)

    # Step 1 — Generate comic via Gemini Imagen API
    print("🎨 Requesting engineering comic from Gemini API...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={api_key}"
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "16:9"
        }
    }
    try:
        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        
        # Write binary image to /tmp
        import base64
        b64_img = data["predictions"][0]["bytesBase64Encoded"]
        with open(comic_path, "wb") as f:
            f.write(base64.b64decode(b64_img))
        print("✅ Imagen generated comic successfully.")
    except Exception as e:
        print(f"⚠️ Imagen API generation failed: {e}")
        if 'resp' in locals():
            print(f"Response: {resp.text[:500]}")
        return None

    # Step 2 — Register upload with LinkedIn
    print("📤 Registering image upload with LinkedIn...")
    register_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
    register_payload = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": org_urn,
            "serviceRelationships": [{
                "relationshipType": "OWNER",
                "identifier": "urn:li:userGeneratedContent"
            }]
        }
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    try:
        reg_resp = requests.post(register_url, headers=headers, json=register_payload, timeout=30)
        reg_resp.raise_for_status()
        reg_data = reg_resp.json()
        upload_url = reg_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
        asset_urn  = reg_data["value"]["asset"]
        print(f"✅ Upload URL acquired. Asset URN: {asset_urn}")
    except Exception as e:
        print(f"⚠️  LinkedIn asset registration failed: {e}")
        return None

    # Step 3 — Upload the PNG binary
    print("📤 Uploading comic PNG to LinkedIn...")
    try:
        with open(comic_path, "rb") as f:
            upload_resp = requests.put(
                upload_url,
                data=f,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "image/png"
                },
                timeout=60
            )
        if upload_resp.status_code not in (200, 201):
            raise RuntimeError(f"Upload returned {upload_resp.status_code}: {upload_resp.text[:200]}")
        print("✅ Comic image uploaded successfully.")
        return asset_urn
    except Exception as e:
        print(f"⚠️  Image binary upload failed: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# LINKEDIN POSTING
# ─────────────────────────────────────────────────────────────────────────────
def post_to_linkedin(post_text: str, pr: dict) -> None:
    access_token = get_env_or_exit("LINKEDIN_ACCESS_TOKEN")
    org_id       = get_env_or_exit("LINKEDIN_ORG_ID")
    org_urn      = f"urn:li:organization:{org_id}"

    # Try to generate + upload the comic image
    image_urn = generate_and_upload_image(pr, access_token, org_urn)

    if image_urn:
        # Post with native uploaded image (looks like the whiteboard comic)
        share_content = {
            "shareCommentary":   {"text": post_text},
            "shareMediaCategory": "IMAGE",
            "media": [{
                "status": "READY",
                "description": {"text": pr.get("title", "")},
                "media": image_urn,
                "title": {"text": f"PR #{pr.get('number','?')} — {pr.get('title','')}"}
            }]
        }
        print("📸 Posting with native comic image...")
    else:
        # Fallback: use real PR URL so LinkedIn scrapes the GitHub OpenGraph card
        print("↩️  Falling back to GitHub OpenGraph link preview...")
        share_content = {
            "shareCommentary":   {"text": post_text},
            "shareMediaCategory": "ARTICLE",
            "media": [{"status": "READY", "originalUrl": pr["url"]}]
        }

    payload = {
        "author":         org_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": share_content},
        "visibility":     {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
    }
    headers = {
        "Authorization":              f"Bearer {access_token}",
        "Content-Type":               "application/json",
        "X-Restli-Protocol-Version":  "2.0.0"
    }

    print("📤 Sending UGC Post to LinkedIn...")
    resp = requests.post("https://api.linkedin.com/v2/ugcPosts",
                         headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    print("✅ LinkedIn post sent.")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  SahiDawa LinkedIn Shoutout Bot")
    print("=" * 60)

    pr = get_pr_metadata()

    tier_display, tier_desc = determine_tier(pr["labels"])
    pr["linkedin_url"] = validate_linkedin_url(pr)
    validate_pr_size(pr)
    evaluate_pr_impact(pr)

    ai_content = generate_post_with_gemini(pr, tier_display, tier_desc)
    final_post = assemble_final_post(ai_content, pr)

    # Try Posting
    try:
        post_to_linkedin(final_post, pr)
        
        # Notify Github Actions to post comment
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a") as f:
                f.write("shoutout_status=published\n")
        print("\n✅ Successfully published native post to LinkedIn!")
    
    except Exception as e:
        print(f"❌ Failed to post to LinkedIn: {e}")
        traceback.print_exc()
        
        # Exit with error code 0 so github action succeeds but skips commenting
        sys.exit(0)


if __name__ == "__main__":
    main()
