import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-development-key",
    {
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
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/${resolvedParams.locale}/login`);
  }

  const role =
    session.user.app_metadata?.role || session.user.user_metadata?.role;

  if (role !== "admin" && role !== "moderator") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="mx-4 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            Access Denied
          </h1>
          <p className="mb-6 text-sm text-slate-500">
            You do not have the required permissions to view the admin dashboard.
            Must be an admin or moderator.
          </p>
          <Link
            href={`/${resolvedParams.locale}/`}
            className="inline-flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
