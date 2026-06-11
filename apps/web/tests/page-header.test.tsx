import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

import { PageHeader } from "../app/[locale]/components/PageHeader";

jest.mock("@/i18n/routing", () => ({
    Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe("PageHeader", () => {
    it("does not render the non-functional quick actions button", () => {
        const markup = renderToStaticMarkup(
            <PageHeader title="Title" subtitle="Subtitle" backHref="/" variant="dark" />
        );

        expect(markup).not.toContain("Quick actions");
        expect(markup).not.toContain("Quick actions menu triggered!");
    });

    it("keeps a spacing placeholder where the quick actions button used to be", () => {
        const markup = renderToStaticMarkup(
            <PageHeader title="Title" subtitle="Subtitle" backHref="/" variant="dark" />
        );

        // Prefer structure-based check: the placeholder div is aria-hidden and has the expected size classes
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).toMatch(/h-10.*w-10/);
    });
});
