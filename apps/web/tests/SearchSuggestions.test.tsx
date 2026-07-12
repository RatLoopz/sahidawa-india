import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import SearchSuggestions, { HistoryItem } from "../components/SearchSuggestions";

jest.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getTotalSize: () => count * 48,
        getVirtualItems: () =>
            Array.from({ length: count }).map((_, i) => ({
                index: i,
                start: i * 48,
                measureElement: jest.fn(),
            })),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
    }),
}));
describe("SearchSuggestions", () => {
    const defaultProps = {
        suggestions: ["Crocin", "Dolo 650"],
        activeIndex: -1,
        onSelect: jest.fn(),
        visible: true,
        isLoading: false,
        error: null,
        noResults: false,
    };

    it("renders suggestions correctly when visible", () => {
        const markup = renderToStaticMarkup(<SearchSuggestions {...defaultProps} />);
        expect(markup).toContain("Crocin");
        expect(markup).toContain("Dolo 650");
    });

    it("renders nothing when not visible", () => {
        const markup = renderToStaticMarkup(
            <SearchSuggestions {...defaultProps} visible={false} />
        );
        expect(markup).toBe("");
    });

    it("renders loading state correctly", () => {
        const markup = renderToStaticMarkup(
            <SearchSuggestions {...defaultProps} isLoading={true} />
        );
        expect(markup).toContain("Searching medicines...");
    });

    it("renders error state correctly", () => {
        const markup = renderToStaticMarkup(
            <SearchSuggestions {...defaultProps} error="Failed to fetch data" />
        );
        expect(markup).toContain("Failed to fetch data");
    });

    it("renders no results message correctly", () => {
        const markup = renderToStaticMarkup(
            <SearchSuggestions {...defaultProps} noResults={true} />
        );
        expect(markup).toContain("No medicines found");
    });

    it("renders history items when in history mode", () => {
        const historyItems: HistoryItem[] = [
            { query: "Calpol", pinned: true, timestamp: Date.now() },
            { query: "Aspirin", pinned: false, timestamp: Date.now() - 1000 },
        ];

        const markup = renderToStaticMarkup(
            <SearchSuggestions
                {...defaultProps}
                isHistory={true}
                historyItems={historyItems}
                suggestions={[]}
            />
        );

        expect(markup).toContain("Recent Searches");
        expect(markup).toContain("Clear All");
        expect(markup).toContain("Calpol");
        expect(markup).toContain("Aspirin");
    });
});
