import { ArrowLeft, Globe, Zap } from "lucide-react";
import { Link } from "@/i18n/routing";

interface PageHeaderProps {
    title?: string;
    subtitle?: string;
    backHref: string;
    variant?: "dark" | "light";
    showLanguage?: boolean;
    languageName?: string;
    children?: React.ReactNode;
}

export const PageHeader = ({
    title,
    subtitle,
    backHref,
    variant = "dark",
    showLanguage = false,
    languageName,
    children,
}: PageHeaderProps) => {
    const isDark = variant === "dark";

    return (
        <header
            className={`${isDark ? "absolute top-0 right-0 left-0 bg-gradient-to-b from-black/70 to-transparent text-white" : "relative border-b border-slate-100 bg-white text-slate-900 shadow-sm"} z-20 flex flex-col gap-4 p-4`}
        >
            <div className="relative flex items-center justify-center">
                {/* Back Button */}
                <Link
                    href={backHref}
                    aria-label="Back to home"
                    className={`absolute left-0 flex items-center gap-2 rounded-full px-3 py-2 transition-all ${
                        isDark
                            ? "bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                    <ArrowLeft size={20} aria-hidden="true" />

                    <span className="hidden text-sm font-semibold sm:inline">Back to Home</span>
                </Link>
                {/* Center Content */}
                {children ? (
                    <div className="text-center">{children}</div>
                ) : (
                    <div className="mr-8 flex flex-col items-center text-center">
                        <span
                            className={`text-sm font-black tracking-wide sm:text-base ${
                                isDark ? "text-emerald-400" : "text-emerald-600"
                            }`}
                        >
                            {title}
                        </span>

                        <span className="text-sm font-medium text-slate-500">{subtitle}</span>
                    </div>
                )}

                {/* Right Side */}
                <div className="absolute right-0">
                    {showLanguage ? (
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                            <Globe size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">
                                {languageName || "English"}
                            </span>
                        </div>
                    ) : isDark ? (
                        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
                            <Zap size={20} className="text-amber-400" />
                        </button>
                    ) : (
                        <div className="w-10" />
                    )}
                </div>
            </div>
        </header>
    );
};
