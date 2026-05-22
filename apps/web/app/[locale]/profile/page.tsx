'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Shield, LogOut } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${locale}`)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push(`/${locale}/login`)
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <User size={40} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Your Profile</h1>
                  <p className="text-emerald-100">Manage your account settings</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
              <User size={20} className="text-emerald-600" />
              <div>
                <p className="text-sm text-slate-500">Full Name</p>
                <p className="font-semibold text-slate-800">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Not provided'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
              <Mail size={20} className="text-emerald-600" />
              <div>
                <p className="text-sm text-slate-500">Email Address</p>
                <p className="font-semibold text-slate-800">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
              <Shield size={20} className="text-emerald-600" />
              <div>
                <p className="text-sm text-slate-500">Account Status</p>
                <p className="font-semibold text-green-600">
                  {user.email_confirmed_at ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}