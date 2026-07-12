# LinkedIn Shoutout AI Prompt Design

## Goal
Redesign the AI prompt for LinkedIn post generation to follow a "Hero's Journey" framework while ensuring high variability so that no two posts look exactly identical.

## Approach: The Hero's Journey
The AI will be instructed to structure the post around four key elements, woven together naturally:
1. **The Hook:** A dynamic opening focused on the real-world impact of the code (e.g., medicine safety, speed, reliability).
2. **The Hero:** Introducing the contributor by name, celebrating their effort.
3. **The Weapon:** A brief technical explanation of what the diff actually solved (architecture, performance, bugfix).
4. **The CTA:** A standard footer inviting others to contribute to SahiDawa.

## Ensuring Variability (Anti-Robot Measures)
To guarantee posts don't look like generic templates:
- **Forbid repetitive openings:** The prompt will explicitly forbid starting every post with "A huge shoutout to..." or "Let's celebrate...".
- **Dynamic Tone:** The prompt will instruct the AI to vary the tone based on the PR's content (e.g., celebratory for UI features, analytical/serious for backend security fixes).
- **Format Flexibility:** The AI will be allowed to use bullet points occasionally, vary paragraph lengths, and use different sets of emojis depending on the context.

## Implementation Plan
1. Update `scripts/linkedin_shoutout.py`.
2. Rewrite the `system_prompt` to include the Hero's Journey instructions and the Variability constraints.
3. Ensure the mandatory footer (Codebase and PR URLs) remains intact and strictly formatted at the very end.
