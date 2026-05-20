"use client";


import { Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
export default function LoginPage() {
  const router = useRouter();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.session?.access_token) {
        localStorage.setItem(
          "sb-access-token",
          data.session.access_token
        );

        router.push("/reports/me");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-emerald-100 p-3 rounded-2xl shadow-sm">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              SahiDawa
            </h1>
            <p className="text-sm text-slate-500">
              Secure Health Verification
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
          
          <div className="mb-7">
            <h2 className="text-3xl font-bold text-slate-900">
              Welcome Back 👋
            </h2>

            <p className="text-slate-500 mt-2">
              Sign in to access your reports and continue using SahiDawa.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Email Address
              </label>

              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-emerald-500 focus-within:bg-white transition">
                <Mail className="w-5 h-5 text-slate-400" />

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>

              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-emerald-500 focus-within:bg-white transition">
                <Lock className="w-5 h-5 text-slate-400" />

                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 transition-all text-white py-3.5 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
            >
              {loading ? "Signing In..." : "Sign In"}

              {!loading && (
                <ArrowRight className="w-5 h-5" />
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-7 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/"
              className="text-emerald-600 font-medium hover:underline"
            >
              Return Home
            </Link>
          </div>
        </div>

        {/* Bottom Text */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Protected by Supabase Authentication • SahiDawa © 2026
        </p>
      </div>
    </div>
  );
}