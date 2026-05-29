"use client";

export const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a
        href={href}
        className="underline-wave text-[13.5px] font-semibold text-slate-600 transition-colors duration-200 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400"
    >
        {children}
    </a>
);
