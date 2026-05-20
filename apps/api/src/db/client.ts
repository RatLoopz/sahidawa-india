import { createClient } from "@supabase/supabase-js";

// 1. Resolve the Supabase URL safely (prioritize backend-specific URL)
const supabaseUrl =
    process.env.SUPABASE_URL || // Used by backend API routes (e.g., host.docker.internal in containers)
    process.env.NEXT_PUBLIC_SUPABASE_URL || // Used by Client Components (.tsx files)
    "http://localhost:54321"; // Local development fallback

// 2. Resolve the Supabase Key safely (prioritize administrative/service keys)
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || // Administrative service key for backend bypass tasks
    process.env.SUPABASE_ANON_KEY || // Standard backend anon key fallback
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || // Used by Client Components (.tsx files)
    "local-development-key";

// Guard against empty strings to avoid cryptic Supabase initialization crashes
// Note: globalThis.WebSocket is polyfilled by ws-setup.js (loaded via ts-node-dev -r)
// before this module is ever imported, so the @supabase/realtime-js Node < 22 check passes.
export const supabase = createClient(supabaseUrl, supabaseKey);
