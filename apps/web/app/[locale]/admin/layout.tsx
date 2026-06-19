import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getAdminRoleFromSession } from "@/lib/adminAuth";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const resolvedParams = await params;
    const t = await getTranslations({
        locale: resolvedParams.locale,
        namespace: "AdminLayout",
    });
    const cookieStore = await cookies();
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // Ignored in Server Component
                }
            },
        },
    });
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        return redirect(`/${resolvedParams.locale}/login`);
    }

    const role = getAdminRoleFromSession(session);

    if (role !== "admin" && role !== "moderator") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
                <div className="mx-4 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-6 w-6 text-red-600"
                        >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h1 className="mb-2 text-xl font-bold text-slate-900">
                        {t("accessDeniedTitle")}
                    </h1>
                    <p className="mb-6 text-sm text-slate-500">{t("accessDeniedDescription")}</p>
                    <Link
                        href="/"
                        className="inline-flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                        {t("returnHome")}
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
