"use client";

import { Home, ScanLine, MapPin, Bell, User } from "lucide-react";

const navItems = [
    { icon: <Home size={21} />, label: "Home", href: "/" },
    { icon: <ScanLine size={21} />, label: "Scan", href: "/scan" },
    { icon: <MapPin size={21} />, label: "Map", href: "/map" },
    { icon: <Bell size={21} />, label: "Alerts", href: "/alerts", badge: true },
    { icon: <User size={21} />, label: "Profile", href: "/profile" },
];

export const MobileBottomNav = () => (
    <>
        <nav
            className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t px-2 py-2.5 pb-[env(safe-area-inset-bottom)] md:hidden"
            style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderColor: "#ccfbf1",
            }}
            aria-label="Mobile navigation"
        >
            {navItems.map(({ icon, label, href, badge }) => (
                <a
                    key={label}
                    href={href}
                    className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors duration-200"
                    style={{ color: href === "/" ? "#0d9488" : "#94a3b8" }}
                    aria-label={label}
                    aria-current={href === "/" ? "page" : undefined}
                >
                    <div className="relative">
                        {icon}
                        {badge && (
                            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                        )}
                    </div>
                    <span className="text-[9.5px] font-bold tracking-wide">{label}</span>
                </a>
            ))}
        </nav>
        <div className="h-16 md:hidden" />
    </>
);
