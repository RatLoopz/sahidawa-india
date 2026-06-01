import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey } from "./env";

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseKey);
