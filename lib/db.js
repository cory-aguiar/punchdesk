import { getClient } from './supabase'

// ── Auth ─────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await getClient().auth.getSession()
  return session
}

export async function getProfile(userId) {
  const { data, error } = await getClient()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await getClient().auth.signOut()
  if (error) throw error
}

export async function signUp({ email, password, firstName, lastName, role = 'employee' }) {
  const { data, error } = await getClient().auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, role }
    }
  })
  if (error) throw error
  return data
}

export async function resetPassword(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) throw error
}

// ── Employees ────────────────────────────────────────────────

export async function getAllEmployees() {
  const { data, error } = await getClient()
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('first_name')
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await getClient()
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Time Entries ─────────────────────────────────────────────

export async function clockIn(employeeId, location = 'remote') {
  // Check if already clocked in
  const { data: active } = await getClient()
    .from('time_entries')
    .select('id')
    .eq('employee_id', employeeId)
    .is('clock_out', null)
    .eq('status', 'active')
    .maybeSingle()
  if (active) throw new Error('Already clocked in')

  const { data, error } = await getClient()
    .from('time_entries')
    .insert({ employee_id: employeeId, clock_in: new Date().toISOString(), location, status: 'active' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function clockOut(entryId, breakMins = 0, notes = '') {
  const { data, error } = await getClient()
    .from('time_entries')
    .update({ clock_out: new Date().toISOString(), break_mins: breakMins, notes, status: 'pending' })
    .eq('id', entryId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getActiveEntry(employeeId) {
  const { data, error } = await getClient()
    .from('time_entries')
    .select('*')
    .eq('employee_id', employeeId)
    .is('clock_out', null)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getEntriesForEmployee(employeeId, { from, to } = {}) {
  let q = getClient()
    .from('time_entries')
    .select('*')
    .eq('employee_id', employeeId)
    .order('clock_in', { ascending: false })
  if (from) q = q.gte('clock_in', from)
  if (to)   q = q.lte('clock_in', to)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function getAllEntries({ from, to, status } = {}) {
  let q = getClient()
    .from('time_entries')
    .select('*, profiles!time_entries_employee_id_fkey(first_name, last_name, department, employment_type)')
    .order('clock_in', { ascending: false })
  if (from)   q = q.gte('clock_in', from)
  if (to)     q = q.lte('clock_in', to)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function approveEntry(entryId, managerId) {
  const { data, error } = await getClient()
    .from('time_entries')
    .update({ status: 'approved', approved_by: managerId, approved_at: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function flagEntry(entryId) {
  const { data, error } = await getClient()
    .from('time_entries')
    .update({ status: 'flagged' })
    .eq('id', entryId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getClockedInNow() {
  const { data, error } = await getClient()
    .from('clocked_in_now')
    .select('*')
  if (error) throw error
  return data || []
}

// ── Time Off ─────────────────────────────────────────────────

export async function submitTimeOff({ employeeId, leaveType, startDate, endDate, daysRequested, notes }) {
  const { data, error } = await getClient()
    .from('time_off_requests')
    .insert({
      employee_id: employeeId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_requested: daysRequested,
      notes,
      status: 'pending'
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getTimeOffForEmployee(employeeId) {
  const { data, error } = await getClient()
    .from('time_off_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getAllTimeOff({ status } = {}) {
  let q = getClient()
    .from('time_off_requests')
    .select('*, profiles!time_off_requests_employee_id_fkey(first_name, last_name, department)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function reviewTimeOff(requestId, { status, reviewerId, denialReason }) {
  const { data, error } = await getClient()
    .from('time_off_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      denial_reason: denialReason || null
    })
    .eq('id', requestId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Holidays ─────────────────────────────────────────────────

export async function getHolidays(year = new Date().getFullYear()) {
  const { data, error } = await getClient()
    .from('holidays')
    .select('*')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date')
  if (error) throw error
  return data || []
}

export async function addHoliday(holiday) {
  const { data, error } = await getClient()
    .from('holidays')
    .insert(holiday)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHoliday(id) {
  const { error } = await getClient()
    .from('holidays')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function isHoliday(date) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0]
  const { data } = await getClient()
    .from('holidays')
    .select('id, name, paid_hours')
    .eq('date', dateStr)
    .maybeSingle()
  return data
}

// ── Notifications ─────────────────────────────────────────────

export async function getNotifications(userId) {
  const { data, error } = await getClient()
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data || []
}

export async function markNotificationRead(id) {
  await getClient().from('notifications').update({ read: true }).eq('id', id)
}

export async function createNotification({ recipientId, type, title, message, link }) {
  const { error } = await getClient()
    .from('notifications')
    .insert({ recipient_id: recipientId, type, title, message, link })
  if (error) console.error('Notification error:', error)
}

// ── Utility ───────────────────────────────────────────────────

export function calcHours(clockIn, clockOut, breakMins = 0) {
  if (!clockOut) return null
  const ms = new Date(clockOut) - new Date(clockIn)
  const totalMins = ms / 60000 - breakMins
  return Math.max(0, totalMins / 60)
}

export function formatHours(hours) {
  if (hours == null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const HST = 'Pacific/Honolulu'  // UTC-10, no daylight saving

export function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: HST })
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: HST })
}

export function getInitials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase()
}
