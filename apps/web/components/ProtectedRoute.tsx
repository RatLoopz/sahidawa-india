'use client'

import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { useEffect } from "react"

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/${locale}/login`)
    }
  }, [status, router, locale])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return session ? <>{children}</> : null
}