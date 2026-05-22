# Pharmacy Map Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue `#224` by moving the pharmacy map UI to a hybrid responsive layout, relocating risk layers into the pharmacy panel, and making the chatbot route-aware so it avoids the map page collision zone.

**Architecture:** Keep the current data-fetching and map behavior intact, but split presentation into testable UI primitives. Add one pure helper for chatbot route-aware positioning, one shared pharmacy panel component for drawer/sidebar rendering, then refactor the map page to use those pieces across mobile and desktop breakpoints.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Jest with `ts-jest`, server-side React rendering for component tests.

---

### Task 1: Add route-aware chatbot positioning with TDD

**Files:**

- Create: `apps/web/app/[locale]/components/chatbotPosition.ts`
- Create: `apps/web/tests/chatbot-position.test.ts`
- Modify: `apps/web/app/[locale]/components/Chatbot.tsx`

- [ ] **Step 1: Write the failing helper tests**

```ts
import {
    getChatbotPositionClasses,
    getChatbotPanelClasses,
    isLocalizedMapRoute,
} from "../app/[locale]/components/chatbotPosition";

describe("isLocalizedMapRoute", () => {
    it("matches localized map routes and nested map paths", () => {
        expect(isLocalizedMapRoute("/en/map")).toBe(true);
        expect(isLocalizedMapRoute("/ta/map/details")).toBe(true);
        expect(isLocalizedMapRoute("/en/health")).toBe(false);
    });
});

describe("getChatbotPositionClasses", () => {
    it("keeps the default right-side position on non-map routes", () => {
        expect(getChatbotPositionClasses({ pathname: "/en", isOpen: false })).toContain("right-6");
    });

    it("moves the launcher to the left side on localized map routes", () => {
        const classes = getChatbotPositionClasses({ pathname: "/en/map", isOpen: false });
        expect(classes).toContain("left-4");
        expect(classes).not.toContain("right-6");
    });
});

describe("getChatbotPanelClasses", () => {
    it("keeps the panel right-anchored on non-map routes", () => {
        expect(getChatbotPanelClasses({ pathname: "/en" })).toContain("right-0");
    });

    it("uses a left-anchored responsive panel on map routes", () => {
        const classes = getChatbotPanelClasses({ pathname: "/en/map" });
        expect(classes).toContain("left-0");
        expect(classes).toContain("max-w-[calc(100vw-2rem)]");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w web -- --runInBand tests/chatbot-position.test.ts`

Expected: FAIL with `Cannot find module '../app/[locale]/components/chatbotPosition'` or missing export errors.

- [ ] **Step 3: Implement the pure helper**

```ts
type ChatbotRouteState = {
    pathname: string | null;
    isOpen?: boolean;
};

export function isLocalizedMapRoute(pathname: string | null): boolean {
    const parts = pathname?.split("/").filter(Boolean) ?? [];
    return parts[1] === "map";
}

export function getChatbotPositionClasses({ pathname, isOpen = false }: ChatbotRouteState): string {
    if (!isLocalizedMapRoute(pathname)) {
        return "bottom-20 right-6 md:bottom-6";
    }

    return isOpen
        ? "left-4 bottom-[calc(15rem+env(safe-area-inset-bottom))] md:bottom-6"
        : "left-4 bottom-6 md:bottom-6";
}

export function getChatbotPanelClasses({ pathname }: Pick<ChatbotRouteState, "pathname">): string {
    if (!isLocalizedMapRoute(pathname)) {
        return "absolute bottom-16 right-0 h-[450px] w-[350px]";
    }

    return "absolute bottom-16 left-0 h-[min(28rem,calc(100vh-8rem))] w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] md:h-[450px] md:w-[350px]";
}
```

- [ ] **Step 4: Wire the helper into the chatbot component**

```tsx
import { usePathname } from "next/navigation";
import { getChatbotPanelClasses, getChatbotPositionClasses } from "./chatbotPosition";

const pathname = usePathname();
const positionClasses = getChatbotPositionClasses({ pathname, isOpen });
const panelClasses = getChatbotPanelClasses({ pathname });

return (
    <div className={`fixed z-50 font-sans ${positionClasses}`}>
        {isOpen && (
            <div
                className={`${panelClasses} flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-2xl transition-all duration-300`}
            >
                <div className="bg-green-600 p-4 text-white">
                    <h3 className="text-sm font-bold">SahiDawa AI</h3>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                    <p className="text-sm leading-relaxed text-gray-800">
                        Hi! I am the SahiDawa AI Assistant.
                    </p>
                </div>
                <div className="border-t border-gray-100 bg-white p-3">
                    <input
                        type="text"
                        placeholder="Ask me about a medicine..."
                        className="w-full rounded-full bg-gray-100 px-4 py-3 text-sm text-gray-800"
                    />
                </div>
            </div>
        )}
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.3)] transition-all hover:scale-105 active:scale-95"
        >
            {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
    </div>
);
```

- [ ] **Step 5: Re-run the focused test**

Run: `npm test -w web -- --runInBand tests/chatbot-position.test.ts`

Expected: PASS

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/web/app/[locale]/components/chatbotPosition.ts apps/web/app/[locale]/components/Chatbot.tsx apps/web/tests/chatbot-position.test.ts
git commit -m "fix(map): make chatbot route-aware on pharmacy map"
```

### Task 2: Extract and test the shared pharmacy panel UI

**Files:**

- Create: `apps/web/app/[locale]/map/PharmacyPanels.tsx`
- Create: `apps/web/tests/pharmacy-panels.test.tsx`

- [ ] **Step 1: Write the failing render tests**

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PharmacyResultsPanel, type HeatmapOption } from "../app/[locale]/map/PharmacyPanels";

const options: HeatmapOption[] = [
    { id: "none", label: "Markers", description: "Show pharmacy markers only" },
    { id: "density", label: "Density", description: "Highlight pharmacy-dense areas" },
];

const pharmacies = [
    {
        id: 1,
        name: "Apollo Pharmacy",
        distance: "1.2 km",
        rating: 0,
        status: "Verified Safe Store",
        type: "govt" as const,
        coordinates: { lat: 28.6, lng: 77.2 },
        isVerified: true,
    },
];

describe("PharmacyResultsPanel", () => {
    it("renders the panel heading, layers control, and pharmacy card", () => {
        const html = renderToStaticMarkup(
            <PharmacyResultsPanel
                count={1}
                isLoading={false}
                pharmacies={pharmacies}
                selectedPharmacyId={1}
                heatmapMode="none"
                heatmapOptions={options}
                riskSummary="2 total clusters"
                onHeatmapChange={() => {}}
                onPharmacySelect={() => {}}
            />
        );

        expect(html).toContain("Nearby Pharmacies");
        expect(html).toContain("Risk layers");
        expect(html).toContain("Apollo Pharmacy");
        expect(html).toContain("Markers");
    });

    it("renders the empty state when there are no pharmacies", () => {
        const html = renderToStaticMarkup(
            <PharmacyResultsPanel
                count={0}
                isLoading={false}
                pharmacies={[]}
                selectedPharmacyId={null}
                heatmapMode="none"
                heatmapOptions={options}
                riskSummary={null}
                onHeatmapChange={() => {}}
                onPharmacySelect={() => {}}
            />
        );

        expect(html).toContain("No pharmacies found");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w web -- --runInBand tests/pharmacy-panels.test.tsx`

Expected: FAIL with `Cannot find module '../app/[locale]/map/PharmacyPanels'`.

- [ ] **Step 3: Implement the shared panel component**

```tsx
export type HeatmapOption = {
    id: HeatmapMode;
    label: string;
    description: string;
};

export function PharmacyResultsPanel(props: PharmacyResultsPanelProps) {
    return (
        <div className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Nearby Pharmacies</p>
                        <p className="text-xs text-slate-400">
                            {props.isLoading
                                ? "Finding nearby pharmacies..."
                                : `${props.count} results`}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-2">
                        <p className="mb-2 text-[11px] font-bold text-slate-500">Risk layers</p>
                        {props.heatmapOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => props.onHeatmapChange(option.id)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                {props.riskSummary && (
                    <p className="mt-2 text-[10px] text-slate-400">{props.riskSummary}</p>
                )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {props.isLoading && (
                    <p className="text-sm font-semibold text-slate-400">
                        Finding nearby pharmacies…
                    </p>
                )}
                {!props.isLoading && props.pharmacies.length === 0 && (
                    <p className="text-sm font-semibold text-slate-400">No pharmacies found</p>
                )}
                {!props.isLoading &&
                    props.pharmacies.map((pharmacy) => (
                        <button
                            key={pharmacy.id}
                            type="button"
                            onClick={() => props.onPharmacySelect(pharmacy.id)}
                            className="flex w-full flex-col rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left"
                        >
                            <span className="text-sm font-semibold text-slate-800">
                                {pharmacy.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                                {pharmacy.distance !== "—"
                                    ? `${pharmacy.distance} away`
                                    : "Distance —"}
                            </span>
                        </button>
                    ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Re-run the focused test**

Run: `npm test -w web -- --runInBand tests/pharmacy-panels.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/web/app/[locale]/map/PharmacyPanels.tsx apps/web/tests/pharmacy-panels.test.tsx
git commit -m "refactor(map): extract shared pharmacy panels"
```

### Task 3: Refactor the map page to the hybrid responsive layout

**Files:**

- Modify: `apps/web/app/[locale]/map/page.tsx`
- Reuse: `apps/web/app/[locale]/map/PharmacyPanels.tsx`

- [ ] **Step 1: Write the failing page-level layout test**

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("../app/[locale]/map/PharmacyMap", () => ({
    __esModule: true,
    default: () => <div data-testid="map-stub">Map</div>,
}));

import PharmacyMapPage from "../app/[locale]/map/page";

describe("PharmacyMapPage layout shell", () => {
    it("renders a desktop sidebar shell and keeps mobile bottom-sheet controls", () => {
        const html = renderToStaticMarkup(<PharmacyMapPage />);

        expect(html).toContain("hidden md:flex");
        expect(html).toContain("md:hidden");
        expect(html).not.toContain("absolute top-28 right-4");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w web -- --runInBand tests/pharmacy-map-layout.test.tsx`

Expected: FAIL because the current page still renders the floating risk card classes and does not include the new sidebar shell.

- [ ] **Step 3: Refactor the page layout around the shared panel**

```tsx
<div className="flex-1 overflow-hidden md:flex md:gap-4 md:p-4">
    <aside className="hidden md:flex md:w-[24rem] md:max-w-[26rem] md:min-w-[24rem]">
        <PharmacyResultsPanel
            count={filteredPharmacies.length}
            isLoading={isLoading}
            pharmacies={filteredPharmacies}
            selectedPharmacyId={selectedPharmacyId}
            heatmapMode={heatmapMode}
            heatmapOptions={heatmapOptions}
            riskSummary={heatmapMode === "none" ? null : `${riskHotspots.length} total clusters`}
            onHeatmapChange={setHeatmapMode}
            onPharmacySelect={(id) => setSelectedPharmacyId(id)}
        />
    </aside>

    <div className="relative flex-1 overflow-hidden rounded-[2rem] md:border md:border-slate-200 md:bg-white md:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <PharmacyMap
            pharmacies={filteredPharmacies}
            selectedPharmacyId={selectedPharmacyId}
            userLocation={userLocation}
            onMapMoveEnd={handleMapMoveEnd}
            onMapReady={handleMapReady}
            autoFitBounds={!isLoading && filteredPharmacies.length > 0}
            initialCenter={userLocation || DEFAULT_CENTER}
            initialZoom={DEFAULT_ZOOM}
            heatmapMode={heatmapMode}
            riskHotspots={riskHotspots}
        />

        <div className="absolute top-4 right-4 z-1000 flex flex-col gap-2">
            <button
                className="md:hidden"
                title="Toggle pharmacy list"
                onClick={() => setShowBottomSheet((open) => !open)}
            >
                <Layers size={20} />
            </button>
            <button onClick={handleLocateUser} title="Find my location">
                <Navigation size={20} />
            </button>
        </div>

        <BottomDrawer
            isOpen={showBottomSheet}
            onClose={() => setShowBottomSheet(false)}
            count={filteredPharmacies.length}
            isLoading={isLoading}
        >
            <div className="md:hidden">
                <PharmacyResultsPanel
                    count={filteredPharmacies.length}
                    isLoading={isLoading}
                    pharmacies={filteredPharmacies}
                    selectedPharmacyId={selectedPharmacyId}
                    heatmapMode={heatmapMode}
                    heatmapOptions={heatmapOptions}
                    riskSummary={
                        heatmapMode === "none" ? null : `${riskHotspots.length} total clusters`
                    }
                    onHeatmapChange={setHeatmapMode}
                    onPharmacySelect={(id) => {
                        setSelectedPharmacyId(id);
                        setShowBottomSheet(true);
                    }}
                />
            </div>
        </BottomDrawer>
    </div>
</div>
```

- [ ] **Step 4: Remove stale floating controls and align the mobile drawer**

```tsx
// Delete the floating right-side heatmap card entirely.
// Delete the desktop-only need for the old collapsed pharmacy pill.
// Keep the bottom drawer and toggle only for mobile via md:hidden classes.
// If the drawer needs a left gutter for the chatbot, apply it only below md.
```

- [ ] **Step 5: Re-run the focused layout test**

Run: `npm test -w web -- --runInBand tests/pharmacy-map-layout.test.tsx`

Expected: PASS

- [ ] **Step 6: Run the full web verification suite**

Run: `npm test -w web -- --runInBand`

Expected: PASS all Jest suites

Run: `cd apps/web && npx tsc --noEmit`

Expected: PASS with no new type errors

Run: `npm run build -w web`

Expected: PASS production build

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/web/app/[locale]/map/page.tsx apps/web/app/[locale]/map/PharmacyPanels.tsx apps/web/tests/pharmacy-map-layout.test.tsx
git commit -m "fix(map): move pharmacy results into responsive panel layout"
```
