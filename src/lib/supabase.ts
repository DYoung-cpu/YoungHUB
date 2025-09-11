import { createClient } from '@supabase/supabase-js'

// These will be your Supabase project credentials
// We'll set these up in the next step
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)