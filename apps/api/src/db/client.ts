import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'local-development-key';

if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
  const msg = '⚠️ Supabase URL or Key is missing. Database connections will fail.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
  console.warn(msg);
}

// We use service role key if available for administrative DB tasks on the backend.
// Guard against createClient receiving empty strings which causes cryptic errors.
export const supabase = createClient(supabaseUrl, supabaseKey);
