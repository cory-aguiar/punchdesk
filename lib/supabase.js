import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lnnbeupwdgtemhbtahbw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubmJldXB3ZGd0ZW1oYnRhaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDE0NTQsImV4cCI6MjA5NDgxNzQ1NH0.O6qLkJi0vh3c0yU-ZYicz3ky9Hs6VQE4LEimQbM-1oA'

let _client = null

export function getClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,   // we manage session ourselves
        autoRefreshToken: false, // prevents background auth calls
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          // Inject stored access token into every request
          get Authorization() {
            if (typeof window !== 'undefined') {
              const token = localStorage.getItem('sb_access_token')
              if (token) return `Bearer ${token}`
            }
            return `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      }
    })
  }
  return _client
}
