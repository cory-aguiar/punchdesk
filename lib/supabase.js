import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client (safe to use in React components)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Singleton for convenience
let _client = null
export function getClient() {
  if (!_client) _client = createClient()
  return _client
}
