import os
import json
import subprocess

def get_git_file(ref, path):
    result = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    if result.returncode != 0:
        return {}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error decoding JSON for {ref}:{path}")
        return {}

def deep_merge(d1, d2):
    for k, v in d2.items():
        if isinstance(v, dict) and k in d1 and isinstance(d1[k], dict):
            deep_merge(d1[k], v)
        else:
            d1[k] = v
    return d1

messages_dir = "apps/web/messages"
for filename in os.listdir(messages_dir):
    if filename.endswith(".json"):
        filepath = os.path.join(messages_dir, filename)
        
        # Check if the file has conflicts
        status = subprocess.run(["git", "ls-files", "-u", filepath], capture_output=True, text=True).stdout
        if status:
            print(f"Resolving {filename}...")
            ours = get_git_file("HEAD", filepath)
            theirs = get_git_file("pr-1226", filepath)
            
            merged = deep_merge(ours, theirs)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(merged, f, indent=2, ensure_ascii=False)
                f.write('\n')
            
            subprocess.run(["git", "add", filepath])
            print(f"Resolved {filename}")

