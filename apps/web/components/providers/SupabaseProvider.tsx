'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [supabase] = useState(() => createClient())

  return (
    <div>{children}</div>
  )
}