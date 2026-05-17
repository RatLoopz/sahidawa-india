import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate required environment variables at startup
if (!process.env.SUPABASE_URL) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variable: SUPABASE_ANON_KEY');
}

// Singleton instance — module-level variable is only initialized once
// because Node.js caches module imports after the first require/import.
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }
  return supabaseInstance;
}

const supabase = getSupabaseClient();

export default supabase;
