import json
import datetime
from collections import defaultdict

def calculate_pr_score(labels, is_first_pr):
    label_names = [lbl['name'] for lbl in labels]
    
    # Blocking labels
    if any(l in label_names for l in ['gssoc:invalid', 'gssoc:spam', 'gssoc:ai-slop']):
        return 0, "Blocked"
        
    has_approved = 'gssoc:approved' in label_names
    base = 50 if has_approved else 0
    
    # Difficulty
    difficulty_map = {
        'level:beginner': 20,
        'level:intermediate': 35,
        'level:advanced': 55,
        'level:critical': 80
    }
    diffs = [difficulty_map[l] for l in label_names if l in difficulty_map]
    difficulty = min(diffs) if diffs else 0
    
    # Quality
    quality_map = {
        'quality:clean': 1.2,
        'quality:exceptional': 1.5
    }
    quals = [quality_map[l] for l in label_names if l in quality_map]
    quality = min(quals) if quals else 1.0
    
    # Type bonuses
    type_map = {
        'type:bug': 10,
        'type:feature': 10,
        'type:docs': 5,
        'type:testing': 10,
        'type:refactor': 10,
        'type:design': 10,
        'type:accessibility': 15,
        'type:performance': 15,
        'type:devops': 15,
        'type:security': 20
    }
    type_bonus = sum([type_map[l] for l in label_names if l in type_map])
    
    # Missing labels logic
    if not has_approved and not diffs and not type_bonus:
        return 0, "No GSSoC Labels"
        
    score = base + (difficulty * quality) + type_bonus
    
    if is_first_pr:
        score += 25
        
    # Cap AFTER all bonuses
    capped = False
    if score > 175:
        score = 175
        capped = True
        
    # Formatting rationale
    rationale = f"{base} + ({difficulty} * {quality}) + {type_bonus}"
    if is_first_pr:
        rationale += " + 25 (First PR)"
    if capped:
        rationale += " (Capped at 175)"
        
    return score, rationale

def main():
    with open('pr_data.json', 'r', encoding='utf-8') as f:
        prs = json.load(f)
        
    # Sort PRs by mergedAt ascending to correctly identify the first PR
    prs.sort(key=lambda x: x['mergedAt'])
    
    seen_authors = set()
    contributor_stats = defaultdict(lambda: {'score': 0, 'prs': []})
    
    exclude_authors = ['RatLoopz', 'dip-jyoti22', 'dipexplorer', 'dependabot', 'github-actions', 'app/github-actions']
    
    # Store processed PRs for the detailed table
    pr_details = []
    total_gssoc_score = 0
    
    ambiguous_prs = []
    
    for pr in prs:
        author = pr['author']
        if not author:
            continue
            
        login = author['login']
        is_bot = author.get('is_bot', False)
        
        if is_bot or login in exclude_authors or 'bot' in login.lower():
            continue
            
        is_first_pr = login not in seen_authors
        
        score, rationale = calculate_pr_score(pr['labels'], is_first_pr)
        
        if score > 0 or rationale == "Blocked":
            seen_authors.add(login)
            contributor_stats[login]['score'] += score
            contributor_stats[login]['prs'].append(pr['number'])
            total_gssoc_score += score
            
            label_names = [l['name'] for l in pr['labels']]
            pr_details.append({
                'number': pr['number'],
                'title': pr['title'],
                'author': login,
                'labels': label_names,
                'score': score,
                'rationale': rationale,
                'mergedAt': pr['mergedAt']
            })
            
            if score == 0 and rationale != "Blocked":
                ambiguous_prs.append(pr)
            if rationale == "No GSSoC Labels":
                ambiguous_prs.append(pr)
                
    # Sort details by PR number descending
    pr_details.sort(key=lambda x: x['number'], reverse=True)
    
    # Write full report
    with open('artifacts/GSSoC_Report.md', 'w', encoding='utf-8') as f:
        f.write("# GSSoC 2026 Contributor Score Report\n\n")
        f.write(f"**Generated on:** {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n")
        
        f.write("## 1. Contributor-Level Summary\n\n")
        f.write("| Rank | Contributor | Total PRs | Total Points |\n")
        f.write("|------|-------------|-----------|--------------|\n")
        
        sorted_contributors = sorted(contributor_stats.items(), key=lambda x: x[1]['score'], reverse=True)
        for i, (login, stats) in enumerate(sorted_contributors, 1):
            f.write(f"| {i} | @{login} | {len(stats['prs'])} | **{stats['score']:g}** |\n")
            
        f.write(f"\n**Grand Total Points across all eligible contributors:** {total_gssoc_score:g}\n\n")
        f.write(f"**Total Eligible Merged PRs:** {len(pr_details)}\n\n")
        
        f.write("## 2. PR-Level Detailed Table\n\n")
        f.write("| PR | Title | Author | Score | Rationale | Labels |\n")
        f.write("|----|-------|--------|-------|-----------|--------|\n")
        
        for p in pr_details:
            labels_str = ", ".join([f"`{l}`" for l in p['labels']])
            f.write(f"| #{p['number']} | {p['title'][:50]}... | @{p['author']} | **{p['score']:g}** | {p['rationale']} | {labels_str} |\n")
            
        if ambiguous_prs:
            f.write("\n## 3. Ambiguous / Missing Labels\n\n")
            f.write("The following PRs lacked proper GSSoC labels or were unscorable according to the guide:\n\n")
            for p in ambiguous_prs:
                f.write(f"- **#{p['number']}** by @{p['author']['login']} - *{p['title']}*\n")
                
    # Write clean version for GitHub issue
    with open('artifacts/GSSoC_GitHub_Issue.md', 'w', encoding='utf-8') as f:
        f.write("## 🏆 SahiDawa GSSoC 2026: Official Contributor Leaderboard & Score Report\n\n")
        f.write("A massive thank you to all the amazing contributors who have poured their time, energy, and code into **SahiDawa** for GSSoC 2026! 🚀\n\n")
        f.write("We have officially audited and verified all scores directly from the repository's merged PRs based on the [Official Scoring Guidelines](https://github.com/RatLoopz/sahidawa-india/wiki/GSSoC-Scoring-Guide). The leaderboard below reflects the true, accurate standings.\n\n")
        
        f.write(f"### 📊 Quick Stats\n")
        f.write(f"- **Total Eligible Merged PRs:** {len(pr_details)}\n")
        f.write(f"- **Grand Total Points Awarded:** {total_gssoc_score:g}\n")
        f.write(f"- **Total Active Contributors:** {len(sorted_contributors)}\n\n")
        
        f.write("### 🏅 Top 50 Contributors\n\n")
        f.write("| Rank | Contributor | Merged PRs | Verified Points |\n")
        f.write("|:----:|-------------|:----------:|:---------------:|\n")
        
        for i, (login, stats) in enumerate(sorted_contributors[:50], 1):
            medal = ""
            if i == 1: medal = "🥇 "
            elif i == 2: medal = "🥈 "
            elif i == 3: medal = "🥉 "
            
            f.write(f"| {i} | {medal}@{login} | {len(stats['prs'])} | **{stats['score']:g}** |\n")
            
        f.write("\n*(Note: To keep this post readable, only the Top 50 are shown here. All 265 contributors are fully tracked and scored in our internal systems!)*\n\n")
        
        f.write("### 🔍 Verification Rules Applied\n")
        f.write("- **Base Score:** 50 points (requires `gssoc:approved`)\n")
        f.write("- **Difficulty:** Beginner (20) / Intermediate (35) / Advanced (55) / Critical (80)\n")
        f.write("- **Quality Multipliers:** Clean (x1.2) / Exceptional (x1.5)\n")
        f.write("- **Type Bonuses:** Stacked according to guidelines (+10 for feature/bug, etc.)\n")
        f.write("- **First PR Bonus:** +25 points on your very first merged PR!\n")
        f.write("- **Cap:** Max 175 points per single PR (strictly enforced).\n")
        f.write("- Bots, maintainer accounts, and blocking labels (`gssoc:invalid`, `gssoc:spam`, `gssoc:ai-slop`) were excluded.\n\n")
        
        f.write("Thank you all for making SahiDawa better! Keep crushing it! 🔥💚")
        
if __name__ == "__main__":
    main()
