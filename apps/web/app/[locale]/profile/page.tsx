'use client'

import { useSession } from "next-auth/react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { User, Mail, Calendar, Shield } from "lucide-react"

export default function ProfilePage() {
  const { data: session } = useSession()

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <User size={40} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Your Profile</h1>
                  <p className="text-emerald-100">Manage your account settings</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <User size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm text-slate-500">Full Name</p>
                  <p className="font-semibold text-slate-800">{session?.user?.name || "Not provided"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <Mail size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm text-slate-500">Email Address</p>
                  <p className="font-semibold text-slate-800">{session?.user?.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <Shield size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm text-slate-500">Account Status</p>
                  <p className="font-semibold text-green-600">Verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}