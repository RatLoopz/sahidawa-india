import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

// Mock react to make useState configurable/mockable
jest.mock("react", () => {
    const originalReact = jest.requireActual("react");
    return {
        ...originalReact,
        useState: jest.fn(originalReact.useState),
    };
});

import LanguageSwitcher from "../app/[locale]/LanguageSwitcher";

const activeLocale = "en";

jest.mock("next-intl", () => ({
    useLocale: () => activeLocale,
    useTranslations: () => (key: string) => key,
}));

jest.mock("../i18n/routing", () => ({
    useRouter: () => ({
        replace: () => undefined,
    }),
    usePathname: () => "/some-path",
}));

describe("LanguageSwitcher Accessibility", () => {
    const mockUseState = React.useState as unknown as jest.Mock;

    afterEach(() => {
        mockUseState.mockReset();
    });

    it("renders closed state with correct ARIA attributes on the trigger button", () => {
        // Mock the two useState calls:
        // 1. open = false
        // 2. focusedIndex = 0
        mockUseState.mockReturnValueOnce([false, jest.fn()]).mockReturnValueOnce([0, jest.fn()]);

        const markup = renderToStaticMarkup(<LanguageSwitcher />);

        // Verify trigger button attributes
        expect(markup).toContain('aria-haspopup="listbox"');
        expect(markup).toContain('aria-expanded="false"');
        expect(markup).toContain('aria-label="select_language"');

        // Verify that the dropdown listbox is NOT rendered
        expect(markup).not.toContain('role="listbox"');
    });

    it("renders open state with correct ARIA attributes and focus styling", () => {
        // Mock the two useState calls:
        // 1. open = true
        // 2. focusedIndex = 1 (Hindi)
        mockUseState.mockReturnValueOnce([true, jest.fn()]).mockReturnValueOnce([1, jest.fn()]);

        const markup = renderToStaticMarkup(<LanguageSwitcher />);

        // Verify trigger button attributes show the expanded popup
        expect(markup).toContain('aria-haspopup="listbox"');
        expect(markup).toContain('aria-expanded="true"');

        // Verify listbox attributes
        expect(markup).toContain('role="listbox"');
        expect(markup).toContain('aria-label="language_options"');
        expect(markup).toContain('aria-activedescendant="lang-option-1"');
        expect(markup).toContain('tabindex="-1"');

        // Verify individual options and their roles
        expect(markup).toContain('role="option"');
        expect(markup).toContain('id="lang-option-0"');
        expect(markup).toContain('aria-selected="true"'); // English is selected
        expect(markup).toContain('id="lang-option-1"');
        expect(markup).toContain('aria-selected="false"'); // Hindi is not selected but is focused

        // Verify focus styling (inset ring) is applied on the focused item
        expect(markup).toContain("ring-2 ring-emerald-500/50");
    });
});
