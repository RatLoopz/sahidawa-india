"use client";
import { useEffect } from "react";
import { usePathname } from "@/i18n/routing";

export function useScrollToTop(offset = 0) {
    const pathname = usePathname();

    useEffect(() => {
        window.scrollTo({ top: offset, behavior: "instant" as ScrollBehavior });
    }, [pathname, offset]);
}
