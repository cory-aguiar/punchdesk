import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://lnnbeupwdgtemhbtahbw.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubmJldXB3ZGd0ZW1oYnRhaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDE0NTQsImV4cCI6MjA5NDgxNzQ1NH0.O6qLkJi0vh3c0yU-ZYicz3ky9Hs6VQE4LEimQbM-1oA'

let _client = null

export function getClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (url, options = {}) => {
          const token = typeof window !== 'undefined'
            ? localStorage.getItem('sb_access_token')
            : null
          // Merge headers carefully — preserve Content-Type from original request
          const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Prefer': 'return=representation',
            ...options.headers,  // original headers override defaults
          }
          return fetch(url, { ...options, headers })
        }
      }
    })
  }
  return _client
}

// Auto-refresh token every 50 minutes (tokens expire after 60 min)
if (typeof window !== 'undefined') {
  setInterval(async () => {
    const refreshToken = localStorage.getItem('sb_refresh_token')
    if (!refreshToken) return
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: refreshToken })
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('sb_access_token', data.access_token)
        localStorage.setItem('sb_refresh_token', data.refresh_token)
        // Reset the client so it picks up the new token
        _client = null
      }
    } catch(e) { console.error('Token refresh failed:', e) }
  }, 50 * 60 * 1000) // every 50 minutes
}
