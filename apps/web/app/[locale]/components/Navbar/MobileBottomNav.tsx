"use client";

import React, { FC } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Camera, MapPin, Bell, User } from "lucide-react";

const mobileNavLabelClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out group-hover:after:scale-x-100 group-active:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

type NavItem = {
    href: string;
    labelKey: string;
    icon: FC<{ size?: number; strokeWidth?: number }>;
    activeColor: string;
    hoverColor: string;
    strokeWidth: number;
    badge?: boolean;
};

const MOBILE_NAV_ITEMS: NavItem[] = [
    {
        href: "/scan",
        labelKey: "scans",
        icon: Camera,
        activeColor: "text-emerald-500",
        hoverColor: "hover:text-emerald-500",
        strokeWidth: 2,
    },
    {
        href: "/map",
        labelKey: "map",
        icon: MapPin,
        activeColor: "text-amber-500",
        hoverColor: "hover:text-amber-500",
        strokeWidth: 2,
    },
    {
        href: "/alerts",
        labelKey: "alerts",
        icon: Bell,
        activeColor: "text-red-500",
        hoverColor: "hover:text-red-500",
        strokeWidth: 2,
        badge: true,
    },
    {
        href: "/profile",
        labelKey: "profile",
        icon: User,
        activeColor: "text-emerald-500",
        hoverColor: "hover:text-emerald-500",
        strokeWidth: 2,
    },
];

interface MobileBottomNavProps {
    isNavVisible: boolean;
}

export default function MobileBottomNav({ isNavVisible }: MobileBottomNavProps) {
    const pathname = usePathname();
    const tNav = useTranslations("Navigation");

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <nav
            className={`fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-(--color-border-muted)/60 bg-(--color-surface-page)/90 px-1 py-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${isNavVisible ? "translate-y-0" : "translate-y-full"}`}
            aria-label="Mobile navigation"
        >
            {MOBILE_NAV_ITEMS.map(
                ({
                    href,
                    labelKey,
                    icon: Icon,
                    activeColor,
                    hoverColor,
                    strokeWidth,
                    badge = false,
                }) => {
                    const active = isActive(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-label={tNav(labelKey)}
                            aria-current={active ? "page" : undefined}
                            className={`group flex w-14 flex-col items-center gap-1 transition-colors ${
                                active ? activeColor : `text-(--color-text-muted) ${hoverColor}`
                            }`}
                        >
                            <div
                                className={`relative transition-transform duration-200 group-hover:-translate-y-0.5 ${active ? "scale-105" : ""}`}
                            >
                                <Icon size={22} strokeWidth={active ? 2.5 : strokeWidth} />
                                {badge && (
                                    <span className="absolute top-0 right-0 h-2 w-2 animate-pulse rounded-full border border-(--color-surface-page) bg-red-500" />
                                )}
                                {active && (
                                    <span
                                        className={`absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${activeColor.replace("text-", "bg-")}`}
                                    />
                                )}
                            </div>
                            <span
                                className={`${mobileNavLabelClassName} text-[10px] ${active ? "font-bold" : "font-semibold"}`}
                            >
                                {tNav(labelKey)}
                            </span>
                        </Link>
                    );
                }
            )}
        </nav>
    );
}
