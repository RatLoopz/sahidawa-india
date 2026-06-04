# ADR — feat: verify and extend Pharmacy & ASHA Worker Map with Leaflet.js (#1132)

> **Date:** 2026-06-03 | **PR:** #1132 | **Status:** Accepted

## Context

The SahiDawa platform required an interactive map feature to display the locations of pharmacies and ASHA (Accredited Social Health Activist) workers, a key component of its rural health platform roadmap. An initial page scaffold existed at `apps/web/app/[locale]/map/`, but the core mapping functionality, data integration, and user interface components for displaying and filtering these health resources were not fully implemented. The objective was to provide users with the ability to locate these health resources efficiently, including filtering and displaying details.

## Decision

Leaflet.js was selected as the primary mapping library for the Pharmacy & ASHA Worker Map feature. This decision leveraged OpenStreetMap tiles, eliminating the need for commercial API keys. The implementation involved:
*   Creating a reusable `MapView.tsx` component within `apps/web/components/map/` to encapsulate Leaflet.js map rendering, marker placement for pharmacies (green) and ASHA workers (blue), popup details, filter toggles, and browser geolocation.
*   Extending the backend (`apps/api`) with PostGIS to manage spatial data. This included new `pharmacies` and `asha_workers` tables, spatial indexes, and SQL functions (`get_nearby_pharmacies`, `get_nearby_asha_workers`) for efficient proximity queries.
*   Adding a new `/api/map` endpoint to serve map data.
*   Integrating the `MapView.tsx` component into the existing `apps/web/app/[locale]/map/page.tsx` scaffold.
*   Ensuring full end-to-end functionality, including TypeScript type safety and Jest mocks for Leaflet to support CI testing.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Google Maps API | While offering robust features and widespread familiarity, Google Maps API typically incurs costs based on usage, requires API key management, and introduces potential vendor lock-in. For an open-source project focused on rural health, a cost-free and open-standard solution was prioritized. |
| Mapbox GL JS | Mapbox GL JS provides highly customizable and performant vector maps, but it also operates on a freemium model with usage-based pricing for higher tiers. For the current scope of displaying markers and basic filtering, Leaflet.js offered a simpler, lighter-weight, and entirely open-source solution that met the immediate requirements without introducing potential future costs or a steeper learning curve for basic map interactions. |

## Consequences

**Positive:**
- Implemented a critical roadmap feature, enhancing the platform's utility for locating health resources.
- Utilized a fully open-source and cost-free mapping solution (Leaflet.js with OpenStreetMap), aligning with the project's open-source ethos and minimizing operational costs.
- Developed a reusable `MapView.tsx` component, promoting modularity and potential for future map-related features.
- Leveraged PostGIS for efficient and scalable spatial data management and proximity queries on the backend.
- Avoided external API key dependencies for core map rendering, simplifying deployment and maintenance.

**Trade-offs:**
- Leaflet.js, while lightweight, may require more custom development for highly advanced mapping features (e.g., complex 3D visualizations, advanced routing algorithms) compared to more feature-rich commercial alternatives.
- Reliance on OpenStreetMap's tile usage policies, which might require self-hosting tiles or using a commercial tile provider if usage scales significantly beyond standard free tiers.
- Increased complexity in the backend due to the introduction of PostGIS and spatial functions, requiring specialized knowledge for database management and optimization.

## Related Issues & PRs

- PR #1132: feat: verify and extend Pharmacy & ASHA Worker Map with Leaflet.js
- Issue #1132