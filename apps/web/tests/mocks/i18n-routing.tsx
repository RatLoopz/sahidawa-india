import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type LinkProps = PropsWithChildren<
    AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
    }
>;

export function Link({ children, href, ...props }: LinkProps) {
    return (
        <a href={href} {...props}>
            {children}
        </a>
    );
}

export function redirect(path: string) {
    return path;
}

export function usePathname() {
    return "/en";
}

export function useRouter() {
    return {
        push: () => undefined,
        replace: () => undefined,
        prefetch: () => Promise.resolve(),
        back: () => undefined,
        forward: () => undefined,
        refresh: () => undefined,
    };
}

export function getPathname() {
    return "/en";
}
