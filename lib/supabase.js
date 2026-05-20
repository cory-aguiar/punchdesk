import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lnnbeupwdgtemhbtahbw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubmJldXB3ZGd0ZW1oYnRhaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDE0NTQsImV4cCI6MjA5NDgxNzQ1NH0.O6qLkJi0vh3c0yU-ZYicz3ky9Hs6VQE4LEimQbM-1oA'

let _client = null
export function getClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _client
}
