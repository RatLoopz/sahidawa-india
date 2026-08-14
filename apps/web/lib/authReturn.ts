const FALLBACK_PATH = "/reports/me";

export function stripLocalePrefix(path: string, locale: string): string {
    const prefix = `/${locale}`;
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
    return path;
}

export function toLocalePath(path: string, locale: string): string {
    const stripped = stripLocalePrefix(path, locale);
    return stripped === "/" ? `/${locale}` : `/${locale}${stripped}`;
}

export function isSafeReturnTo(path: string | null | undefined): path is string {
    return (
        typeof path === "string" &&
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.includes("\\") &&
        !path.includes("%0a") &&
        !path.includes("%0d") &&
        !path.includes("%0A") &&
        !path.includes("%0D") &&
        path !== "/" &&
        // Never land the user back on the login screen (self-redirect loop).
        !path.split("/").includes("login")
    );
}

export function buildLoginPath(locale: string, returnTo?: string | null): string {
    const target = isSafeReturnTo(returnTo) ? returnTo : null;
    const login = `/${locale}/login`;
    if (!target || target === FALLBACK_PATH) return login;
    return `${login}?returnTo=${encodeURIComponent(target)}`;
}
