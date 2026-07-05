import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// Only null when env vars are missing (e.g. Supabase project not created
// yet). Callers must check `isSupabaseConfigured` before using this.
export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
