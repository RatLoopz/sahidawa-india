export interface SyncTier {
    tier: number;
    description: string;
    assets: string[];
}

export const syncConfig: SyncTier[] = [
    {
        tier: 1,
        description: "Core localization keys and essential medicine data templates",
        assets: ["en-core.json", "hi-core.json", "med-defaults.json"],
    },
    {
        tier: 2,
        description: "Regional language datasets and expanded offline directories",
        assets: ["gu-regional.json", "te-regional.json", "or-regional.json"],
    },
    {
        tier: 3,
        description: "High-resolution instructional media and non-critical assets",
        assets: ["media-guide.mp4", "assets-extended.json"],
    },
];
