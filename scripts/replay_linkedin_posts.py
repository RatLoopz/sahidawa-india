#!/usr/bin/env python3
"""
Admin script to manually retry failed LinkedIn shoutouts from the Supabase queue.
Usage:
    python scripts/replay_linkedin_posts.py
"""

import os
import sys
import subprocess
import traceback
from datetime import datetime, timezone
try:
    from supabase import create_client
except ImportError:
    print("Please install supabase: pip install supabase")
    sys.exit(1)

def get_supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).")
        sys.exit(1)
    return create_client(url, key)

def fetch_pr_data(pr_number: int):
    print(f"Fetching PR data for #{pr_number} via gh CLI...")
    try:
        import json
        result = subprocess.run(
            ["gh", "pr", "view", str(pr_number), "--json", "title,author,url,labels,body,headRefName,baseRefName,additions,deletions"],
            capture_output=True, text=True, check=True
        )
        pr_data = json.loads(result.stdout)
        
        diff_result = subprocess.run(
            ["gh", "pr", "diff", str(pr_number)],
            capture_output=True, text=True, check=True
        )
        diff_text = diff_result.stdout
        
        return pr_data, diff_text
    except Exception as e:
        print(f"Failed to fetch PR #{pr_number} data: {e}")
        return None, None

def main():
    print("🔄 Checking Supabase for pending/failed LinkedIn shoutouts...")
    db = get_supabase_client()
    
    try:
        # Fetch records that are FAILED and their next_retry_at is in the past
        now = datetime.now(timezone.utc).isoformat()
        response = db.table('linkedin_shoutouts').select('*').eq('status', 'FAILED').lte('next_retry_at', now).execute()
        
        records = response.data
        if not records:
            print("✅ No pending retries found.")
            return

        print(f"Found {len(records)} shoutouts to retry.")
        
        for record in records:
            pr_number = record['pr_number']
            print(f"\n▶️ Retrying PR #{pr_number}...")
            
            pr_data, diff_text = fetch_pr_data(pr_number)
            if not pr_data:
                continue
                
            labels_str = ",".join([lbl["name"] for lbl in pr_data.get("labels", [])])
            lines_changed = pr_data.get("additions", 0) + pr_data.get("deletions", 0)
            
            # Setup environment variables for linkedin_shoutout.py
            env = os.environ.copy()
            env["PR_TITLE"] = pr_data.get("title", "")
            env["PR_AUTHOR"] = pr_data.get("author", {}).get("login", "")
            env["PR_URL"] = pr_data.get("url", "")
            env["PR_NUMBER"] = str(pr_number)
            env["PR_LABELS"] = labels_str
            env["PR_BODY"] = (pr_data.get("body", "") or "")[:500]
            env["PR_REPO"] = "RatLoopz/sahidawa-india"  # Hardcoded for now
            env["PR_LINES_CHANGED"] = str(lines_changed)
            env["PR_GIT_DIFF"] = diff_text[:140000]
            
            try:
                # Call the script
                result = subprocess.run(
                    ["python", "scripts/linkedin_shoutout.py"],
                    env=env,
                    check=True
                )
                print(f"✅ Successfully re-ran script for PR #{pr_number}")
            except subprocess.CalledProcessError as e:
                print(f"❌ Script failed for PR #{pr_number} with exit code {e.returncode}")
                
    except Exception as e:
        print(f"❌ Error querying database: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
