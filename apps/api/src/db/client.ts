import { createClient } from '@supabase/supabase-js';

// 1. Resolve the Supabase URL safely
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL ||   // Used by Client Components (.tsx files)
  process.env.SUPABASE_URL ||              // Used by backend API routes
  'http://localhost:54321';                // Local development fallback

// 2. Resolve the Supabase Key safely
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || // Used by Client Components (.tsx files)
  process.env.SUPABASE_SERVICE_ROLE_KEY ||    // Administrative service key for backend bypass tasks
  process.env.SUPABASE_ANON_KEY ||            // Standard backend anon key fallback
  'local-development-key';

// Guard against empty strings to avoid cryptic Supabase initialization crashes
export const supabase = createClient(supabaseUrl, supabaseKey);