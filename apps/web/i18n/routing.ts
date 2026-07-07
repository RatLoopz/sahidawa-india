import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
    locales: [
        "en",
        "ta",
        "bn",
        "te",
        "mr",
        "gu",
        "ur",
        "or",
        "hi",
        "kn",
        "pa",
        "as",
        "ks",
        "kok",
        "mai",
        "ml",
        "sa",
        "mni",
        "sd",
    ],
    defaultLocale: "en",
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
