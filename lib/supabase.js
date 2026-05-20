import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lnnbeupwdgtemhbtahbw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_O0cXNrUrGxrFH0rNdVzTpA_gcMStfNm'

let _client = null
export function getClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _client
}
