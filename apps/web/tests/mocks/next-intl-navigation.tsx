import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type LinkProps = PropsWithChildren<
    AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
    }
>;

export function createNavigation() {
    return {
        Link: ({ children, href, ...props }: LinkProps) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
        redirect: (path: string) => path,
        usePathname: () => "/en",
        useRouter: () => ({
            push: () => undefined,
            replace: () => undefined,
            prefetch: () => Promise.resolve(),
            back: () => undefined,
            forward: () => undefined,
            refresh: () => undefined,
        }),
        getPathname: () => "/en",
    };
}
