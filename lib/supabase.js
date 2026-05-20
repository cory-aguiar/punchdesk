import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fadoxpymqbxxhhootfog.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZG94cHltcWJ4eGhob290Zm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzA2ODUsImV4cCI6MjA5NDgwNjY4NX0.b2lGTsgA46XUoKBTac6aathuBEonngold8Lp5cxUF-c'

let _client = null
export function getClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _client
}
