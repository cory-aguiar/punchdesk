import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import { getClient } from '../lib/supabase'
import {
  signIn, signOut, getProfile,
  clockIn, clockOut, getActiveEntry, getEntriesForEmployee,
  getAllEmployees, getAllEntries, approveEntry, flagEntry, getClockedInNow,
  submitTimeOff, getTimeOffForEmployee, getAllTimeOff, reviewTimeOff,
  getHolidays, addHoliday, deleteHoliday,
  calcHours, formatHours, formatTime, formatDate, getInitials
} from '../lib/db'

// ─── Color Palette ────────────────────────────────────────────
// #000000  pure black      → primary actions, active states
// #333333  dark charcoal   → sidebar bg, hero bg
// #575757  medium dark     → secondary text, icons
// #808080  medium gray     → borders, muted elements
// #A8A8A8  light gray      → placeholder text, subtle fills
// #ffffff  white           → cards, main background text

const C = {
  black:      '#000000',
  charcoal:   '#333333',
  darkGray:   '#575757',
  midGray:    '#808080',
  lightGray:  '#A8A8A8',
  silver:     '#D4D4D4',
  offWhite:   '#F2F2F2',
  white:      '#FFFFFF',
}

// ─── Helpers ──────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
function fmtClock(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function fmtDateLong(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
function weekStart(d = new Date()) {
  const dd = new Date(d); dd.setDate(dd.getDate() - dd.getDay() + 1); dd.setHours(0,0,0,0); return dd
}

// ─── Base Components ──────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div style={{ position:'fixed', bottom:24, right:24, display:'flex', flexDirection:'column', gap:8, zIndex:9999, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#1a1a1a' : C.charcoal,
          color: t.type === 'error' ? '#ff6b6b' : '#fff',
          padding:'11px 18px', borderRadius:6, fontSize:13,
          display:'flex', alignItems:'center', gap:8,
          boxShadow:'0 4px 20px rgba(0,0,0,.4)',
          border: `1px solid ${t.type === 'error' ? '#ff6b6b44' : C.darkGray}`,
          animation:'slideUp .22s ease', fontFamily:'var(--font)',
        }}>
          <span style={{ opacity:.7 }}>{t.type === 'error' ? '!' : '✓'}</span>{t.msg}
        </div>
      ))}
    </div>
  )
}

function Badge({ children, variant = 'default' }) {
  const styles = {
    default:  { bg: C.offWhite,   text: C.darkGray,  border: C.silver },
    active:   { bg: C.black,      text: C.white,     border: C.black },
    approved: { bg: '#1a1a1a',    text: '#a8a8a8',   border: C.charcoal },
    pending:  { bg: C.offWhite,   text: C.charcoal,  border: C.silver },
    flagged:  { bg: '#2a1a1a',    text: '#ff8080',   border: '#ff808040' },
    remote:   { bg: C.offWhite,   text: C.midGray,   border: C.silver },
    admin:    { bg: C.black,      text: C.white,     border: C.black },
    manager:  { bg: C.charcoal,   text: C.lightGray, border: C.darkGray },
    employee: { bg: C.offWhite,   text: C.charcoal,  border: C.silver },
    holiday:  { bg: C.charcoal,   text: C.lightGray, border: C.darkGray },
    upcoming: { bg: C.black,      text: C.white,     border: C.black },
    past:     { bg: C.offWhite,   text: C.lightGray, border: C.silver },
  }
  const s = styles[variant] || styles.default
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:4, fontSize:11, fontWeight:500, letterSpacing:.3, background:s.bg, color:s.text, border:`1px solid ${s.border}` }}>
      {children}
    </span>
  )
}

function Avatar({ first, last, size = 34 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background: C.charcoal, color: C.lightGray,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.32, fontWeight:600, flexShrink:0,
      fontFamily:'var(--mono)', letterSpacing:1,
      border: `1px solid ${C.darkGray}`,
    }}>
      {getInitials(first, last)}
    </div>
  )
}

function Modal({ open, onClose, title, children, width = 460 }) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:800, backdropFilter:'blur(4px)' }}/>
      <div style={{
        position:'fixed', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        background:C.white, borderRadius:8, padding:'28px 32px',
        width, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto',
        zIndex:900, boxShadow:'0 24px 80px rgba(0,0,0,.4)',
        border:`1px solid ${C.silver}`,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div style={{ fontSize:15, fontWeight:600, color:C.black, letterSpacing:-.3 }}>{title}</div>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:C.lightGray, padding:'2px 8px', borderRadius:4, fontFamily:'var(--font)' }}>×</button>
        </div>
        {children}
      </div>
    </>
  )
}

function FormLabel({ children }) {
  return <label style={{ fontSize:11, fontWeight:600, color:C.midGray, textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:5 }}>{children}</label>
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <FormLabel>{label}</FormLabel>}
      <input {...props} style={{
        border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px',
        fontFamily:'var(--font)', fontSize:13, background:C.white, color:C.black,
        outline:'none', width:'100%', boxSizing:'border-box', transition:'border-color .14s',
        ...(props.style||{})
      }}/>
    </div>
  )
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <FormLabel>{label}</FormLabel>}
      <select {...props} style={{
        border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px',
        fontFamily:'var(--font)', fontSize:13, background:C.white, color:C.black,
        width:'100%', cursor:'pointer', outline:'none',
        ...(props.style||{})
      }}>
        {children}
      </select>
    </div>
  )
}

function Btn({ children, variant='primary', size='md', style:s, ...props }) {
  const v = {
    primary: { bg:C.black,     color:C.white,     border:C.black },
    outline: { bg:'transparent', color:C.charcoal, border:C.silver },
    danger:  { bg:'transparent', color:'#cc4444',  border:'#cc4444' },
    ghost:   { bg:'transparent', color:C.midGray,  border:'transparent' },
  }
  const sz = { sm:{ padding:'5px 12px', fontSize:12 }, md:{ padding:'9px 18px', fontSize:13 }, lg:{ padding:'13px 26px', fontSize:14 } }
  const st = v[variant]||v.primary
  return (
    <button {...props} style={{
      display:'inline-flex', alignItems:'center', gap:7,
      borderRadius:5, fontFamily:'var(--font)', fontWeight:500,
      cursor:'pointer', transition:'all .14s', whiteSpace:'nowrap',
      background:st.bg, color:st.color, border:`1px solid ${st.border}`,
      letterSpacing:.2,
      ...sz[size], ...s
    }}>
      {children}
    </button>
  )
}

function Card({ children, style:s }) {
  return (
    <div style={{
      background:C.white, border:`1px solid ${C.silver}`,
      borderRadius:8, padding:22,
      boxShadow:'0 1px 4px rgba(0,0,0,.06)', ...s
    }}>
      {children}
    </div>
  )
}

function CardHeader({ title, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, gap:12 }}>
      <div style={{ fontSize:13, fontWeight:600, color:C.black, textTransform:'uppercase', letterSpacing:.8 }}>{title}</div>
      {right && <div style={{ fontSize:12, color:C.midGray, fontFamily:'var(--mono)' }}>{right}</div>}
    </div>
  )
}

function StatCard({ label, value, sub, subColor }) {
  return (
    <Card>
      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.8, color:C.lightGray, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:600, fontFamily:'var(--mono)', letterSpacing:-2, color:C.black }}>{value}</div>
      {sub && <div style={{ fontSize:12, color: subColor||C.lightGray, marginTop:3 }}>{sub}</div>}
    </Card>
  )
}

function Divider() {
  return <div style={{ height:1, background:C.silver, margin:'6px 0' }}/>
}

// ─── Table helpers ────────────────────────────────────────────
const TH = ({ children }) => (
  <th style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.6, color:C.lightGray, borderBottom:`1px solid ${C.silver}`, background:C.offWhite, whiteSpace:'nowrap' }}>
    {children}
  </th>
)
const TD = ({ children, style:s }) => (
  <td style={{ padding:'11px 14px', borderBottom:`1px solid ${C.offWhite}`, verticalAlign:'middle', ...s }}>
    {children}
  </td>
)

// ─── Login Page ────────────────────────────────────────────────
function LoginPage({ onLogin, toast }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [resetModal, setResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const SURL = 'https://lnnbeupwdgtemhbtahbw.supabase.co'
      const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubmJldXB3ZGd0ZW1oYnRhaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDE0NTQsImV4cCI6MjA5NDgxNzQ1NH0.O6qLkJi0vh3c0yU-ZYicz3ky9Hs6VQE4LEimQbM-1oA'

      // Sign in using raw fetch — bypasses any JS library CSP issues
      const authRes = await fetch(`${SURL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SKEY,
        },
        body: JSON.stringify({ email, password: pw })
      })
      const authData = await authRes.json()
      if (!authRes.ok) throw new Error(authData.error_description || authData.msg || 'Invalid email or password')
      
      const accessToken = authData.access_token
      const userId = authData.user?.id
      if (!userId) throw new Error('Login failed — no user returned')

      // Store the session token so Supabase client can use it
      const sb = getClient()
      await sb.auth.setSession({ access_token: accessToken, refresh_token: authData.refresh_token })

      // Fetch profile using raw fetch with the access token
      const profileRes = await fetch(`${SURL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: {
          'apikey': SKEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      const profileArr = await profileRes.json()
      const d = (profileArr && profileArr[0]) || {}

      const profile = {
        id: userId,
        email: authData.user?.email || '',
        first_name: d.first_name || authData.user?.email?.split('@')[0] || 'User',
        last_name: d.last_name || '',
        role: d.role || 'employee',
        department: d.department || '',
        employment_type: d.employment_type || 'fulltime',
        pto_balance: d.pto_balance ?? 15,
        pto_used: d.pto_used ?? 0,
        is_active: d.is_active ?? true,
        hourly_rate: d.hourly_rate || 0,
      }
      onLogin(authData.user, profile)
    } catch (e) { setErr(e.message || 'Invalid email or password') }
    finally { setLoading(false) }
  }

  async function handleReset() {
    if (!resetEmail) return
    try {
      const { error } = await getClient().auth.resetPasswordForEmail(resetEmail, { redirectTo: window.location.origin })
      if (error) throw error
      toast('Password reset email sent')
      setResetModal(false)
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.offWhite, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo + wordmark */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ width:72, height:72, margin:'0 auto 18px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src="/logo.png" alt="Company Logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
            />
            {/* Fallback if no logo */}
            <div style={{ display:'none', width:60, height:60, borderRadius:10, background:C.black, alignItems:'center', justifyContent:'center' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="9" stroke="#808080" strokeWidth="1.5" fill="none"/>
                <path d="M14 8v6.5l4 2.5" stroke="#a8a8a8" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize:26, fontWeight:600, letterSpacing:-.5, color:C.black }}>PunchDesk</div>
          <div style={{ fontSize:12, color:C.midGray, marginTop:4, letterSpacing:.3 }}>WORKFORCE MANAGEMENT</div>
        </div>

        <Card>
          <form onSubmit={handleLogin}>
            <Input label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required autoFocus/>
            <Input label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" required/>
            {err && (
              <div style={{ background:'#fff0f0', color:'#cc4444', border:'1px solid #ffcccc', borderRadius:5, padding:'9px 12px', fontSize:12, marginBottom:14, lineHeight:1.5 }}>
                {err}
                <div style={{marginTop:6, fontSize:11, color:'#aa3333'}}>
                  If this keeps happening, open your browser console (F12) and look for red errors, then share them with your admin.
                </div>
              </div>
            )}
            <Btn type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'12px 0', fontSize:14 }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Btn>
          </form>
          <div style={{ textAlign:'center', marginTop:14 }}>
            <button onClick={()=>setResetModal(true)} style={{ background:'none', border:'none', color:C.midGray, fontSize:12, cursor:'pointer', fontFamily:'var(--font)', textDecoration:'underline' }}>
              Forgot password?
            </button>
          </div>
        </Card>

        <div style={{ textAlign:'center', marginTop:24, fontSize:11, color:C.lightGray, letterSpacing:.3 }}>
          NEW EMPLOYEE? YOUR MANAGER WILL SEND AN INVITATION.
        </div>

        <Modal open={resetModal} onClose={()=>setResetModal(false)} title="Reset Password" width={360}>
          <p style={{ fontSize:13, color:C.midGray, marginBottom:16, lineHeight:1.6 }}>Enter your work email and we'll send a reset link.</p>
          <Input label="Email" type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="you@company.com"/>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn variant="outline" onClick={()=>setResetModal(false)}>Cancel</Btn>
            <Btn onClick={handleReset}>Send Link</Btn>
          </div>
        </Modal>
      </div>
    </div>
  )
}

// ─── Inline Edit Request Button (used on clock page rows) ───────
function EditRequestButton({ entry, profile, toast }) {
  const sb = getClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clockIn:'', clockOut:'', breakMins:0, reason:'' })
  const [submitting, setSubmitting] = useState(false)

  function formatForInput(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2,'0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function openModal() {
    setForm({
      clockIn: formatForInput(entry.clock_in),
      clockOut: formatForInput(entry.clock_out),
      breakMins: entry.break_mins || 0,
      reason: ''
    })
    setOpen(true)
  }

  async function submit() {
    if (!form.clockIn) { toast('Clock-in time required','error'); return }
    if (!form.reason.trim()) { toast('Please explain why this edit is needed','error'); return }
    setSubmitting(true)
    try {
      const { error } = await sb.from('timesheet_edit_requests').insert({
        employee_id: profile.id,
        time_entry_id: entry.id,
        original_clock_in: entry.clock_in,
        original_clock_out: entry.clock_out,
        original_break_mins: entry.break_mins || 0,
        requested_clock_in: new Date(form.clockIn).toISOString(),
        requested_clock_out: form.clockOut ? new Date(form.clockOut).toISOString() : null,
        requested_break_mins: parseInt(form.breakMins) || 0,
        reason: form.reason.trim(),
        status: 'pending'
      })
      if (error) throw error
      toast('Edit request submitted for approval')
      setOpen(false)
    } catch(e) { toast(e.message,'error') }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <button onClick={openModal} style={{
        border:`1px solid ${C.silver}`, background:'transparent', borderRadius:5,
        padding:'4px 10px', fontSize:11, fontFamily:'var(--font)', cursor:'pointer',
        color:C.midGray, fontWeight:500, transition:'all .12s',
        whiteSpace:'nowrap',
      }}
        onMouseEnter={e=>{e.target.style.borderColor=C.darkGray;e.target.style.color=C.black}}
        onMouseLeave={e=>{e.target.style.borderColor=C.silver;e.target.style.color=C.midGray}}
      >
        ✎ Edit
      </button>

      <Modal open={open} onClose={()=>setOpen(false)} title="Request Timesheet Edit">
        {/* Current entry summary */}
        <div style={{ background:C.offWhite, borderRadius:6, padding:'10px 14px', marginBottom:18 }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:C.lightGray, marginBottom:6 }}>Current Entry</div>
          <div style={{ display:'flex', gap:20, fontSize:13, flexWrap:'wrap' }}>
            <span><span style={{color:C.midGray}}>Date:</span> {formatDate(entry.clock_in)}</span>
            <span><span style={{color:C.midGray}}>In:</span> <span style={{fontFamily:'var(--mono)'}}>{formatTime(entry.clock_in)}</span></span>
            <span><span style={{color:C.midGray}}>Out:</span> <span style={{fontFamily:'var(--mono)'}}>{formatTime(entry.clock_out)}</span></span>
            <span style={{color:C.midGray}}>Break: {entry.break_mins||0}m</span>
          </div>
        </div>

        <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Enter corrected values:</div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Corrected Clock In" type="datetime-local"
            value={form.clockIn} onChange={e=>setForm(f=>({...f,clockIn:e.target.value}))}/>
          <Input label="Corrected Clock Out" type="datetime-local"
            value={form.clockOut} onChange={e=>setForm(f=>({...f,clockOut:e.target.value}))}/>
        </div>
        <Input label="Break (minutes)" type="number" min="0" max="120"
          value={form.breakMins} onChange={e=>setForm(f=>({...f,breakMins:e.target.value}))} placeholder="0"/>

        <div style={{ marginBottom:16 }}>
          <FormLabel>Reason for Edit <span style={{color:'#cc4444'}}>*</span></FormLabel>
          <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
            rows={3} placeholder="e.g. Forgot to clock out, missed punch, system was down, working offsite without access…"
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box' }}/>
          <div style={{ fontSize:11, color:C.lightGray, marginTop:4 }}>This note will be shown to your manager with the request.</div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={()=>setOpen(false)}>Cancel</Btn>
          <Btn onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for Approval'}</Btn>
        </div>
      </Modal>
    </>
  )
}

// ─── Time Clock Page ───────────────────────────────────────────
function ClockPage({ profile, toast }) {
  const [now, setNow] = useState(new Date())
  const [activeEntry, setActiveEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [location, setLocation] = useState('remote')
  const [outModal, setOutModal] = useState(false)
  const [breakMins, setBreakMins] = useState(0)
  const [note, setNote] = useState('')

  useEffect(() => { const t = setInterval(()=>setNow(new Date()), 1000); return ()=>clearInterval(t) }, [])
  useEffect(() => { load() }, [profile.id])

  async function load() {
    try {
      const [entry, recent] = await Promise.all([
        getActiveEntry(profile.id),
        getEntriesForEmployee(profile.id, { from: new Date(Date.now()-14*86400000).toISOString() })
      ])
      setActiveEntry(entry); setEntries(recent||[])
    } catch(e) { toast(e.message,'error') }
    finally { setLoading(false) }
  }

  async function handleClockIn() {
    try { const e = await clockIn(profile.id, location); setActiveEntry(e); toast('Clocked in') }
    catch(e) { toast(e.message,'error') }
  }

  async function confirmClockOut() {
    try {
      await clockOut(activeEntry.id, parseInt(breakMins)||0, note)
      setActiveEntry(null); setOutModal(false); setBreakMins(0); setNote('')
      toast('Clocked out — great work!'); load()
    } catch(e) { toast(e.message,'error') }
  }

  const elapsed = activeEntry ? calcHours(activeEntry.clock_in, now.toISOString()) : null

  return (
    <div>
      {/* Clock Hero */}
      <div style={{
        background:C.charcoal, borderRadius:10, padding:'36px 40px',
        color:C.white, display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20, position:'relative', overflow:'hidden',
        border:`1px solid ${C.darkGray}`,
      }}>
        {/* Decorative ring */}
        <div style={{ position:'absolute', right:-80, top:-80, width:240, height:240, borderRadius:'50%', border:`1px solid ${C.darkGray}`, opacity:.4 }}/>
        <div style={{ position:'absolute', right:-40, top:-40, width:160, height:160, borderRadius:'50%', border:`1px solid ${C.midGray}`, opacity:.2 }}/>

        <div>
          <div style={{ fontSize:60, fontWeight:300, fontFamily:'var(--mono)', letterSpacing:-4, lineHeight:1, color:C.white }}>
            {fmtClock(now)}
          </div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:8, letterSpacing:.3 }}>{fmtDateLong(now).toUpperCase()}</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:16, background:'rgba(255,255,255,.06)', padding:'7px 16px', borderRadius:4, fontSize:12, border:`1px solid ${C.darkGray}`, letterSpacing:.3 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background: activeEntry ? '#6fcf97' : C.midGray, boxShadow: activeEntry ? '0 0 8px #6fcf9788' : 'none' }}/>
            {activeEntry ? `CLOCKED IN · ${formatHours(elapsed)}` : 'NOT CLOCKED IN'}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, zIndex:1, minWidth:160 }}>
          {!activeEntry ? (
            <>
              <select value={location} onChange={e=>setLocation(e.target.value)} style={{
                background:'rgba(255,255,255,.08)', color:C.lightGray,
                border:`1px solid ${C.darkGray}`, borderRadius:5, padding:'9px 12px',
                fontFamily:'var(--font)', fontSize:12, cursor:'pointer', letterSpacing:.3,
              }}>
                <option value="remote">REMOTE</option>
                <option value="office">OFFICE</option>
                <option value="field">FIELD / ONSITE</option>
              </select>
              <button onClick={handleClockIn} style={{
                background:C.white, color:C.black, border:'none',
                padding:'13px 0', borderRadius:5, fontFamily:'var(--font)',
                fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:.5,
              }}>CLOCK IN</button>
            </>
          ) : (
            <>
              <div style={{ fontSize:11, color:C.midGray, textAlign:'center', letterSpacing:.5, textTransform:'uppercase' }}>
                {activeEntry.location}
              </div>
              <button onClick={()=>setOutModal(true)} style={{
                background:'transparent', color:'#ff8080', border:'1px solid #ff808060',
                padding:'13px 0', borderRadius:5, fontFamily:'var(--font)',
                fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:.5,
              }}>CLOCK OUT</button>
            </>
          )}
        </div>
      </div>

      {/* Recent entries */}
      <Card>
        <CardHeader title="Recent Entries" right={loading ? 'Loading…' : `${entries.length} entries`}/>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>{['Date','Location','Clock In','Clock Out','Break','Hours','Status',''].map(h=><TH key={h}>{h}</TH>)}</tr>
            </thead>
            <tbody>
              {entries.length===0 && <tr><TD colSpan={8} style={{ textAlign:'center', color:C.lightGray, padding:32 }}>No recent entries</TD></tr>}
              {entries.map(e=>(
                <tr key={e.id} style={{ transition:'background .1s' }}>
                  <TD>{formatDate(e.clock_in)}</TD>
                  <TD style={{ color:C.midGray, fontSize:12, textTransform:'uppercase', letterSpacing:.3 }}>{e.location||'—'}</TD>
                  <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_in)}</TD>
                  <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{e.clock_out ? formatTime(e.clock_out) : <Badge variant="active">Active</Badge>}</TD>
                  <TD style={{ fontFamily:'var(--mono)', fontSize:12, color:C.midGray }}>{e.break_mins ? `${e.break_mins}m` : '—'}</TD>
                  <TD style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>
                    {e.clock_out ? formatHours(calcHours(e.clock_in,e.clock_out,e.break_mins)) : <span style={{color:C.midGray}}>In progress</span>}
                  </TD>
                  <TD><Badge variant={e.status==='approved'?'approved':e.status==='flagged'?'flagged':e.status==='active'?'active':'pending'}>{e.status}</Badge></TD>
                  <TD>
                    {e.clock_out && (
                      <EditRequestButton entry={e} profile={profile} toast={toast}/>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={outModal} onClose={()=>setOutModal(false)} title="Clock Out" width={380}>
        <p style={{ fontSize:13, color:C.midGray, marginBottom:18, lineHeight:1.6 }}>Log any break time before clocking out.</p>
        <Input label="Break Time (minutes)" type="number" min="0" max="120" value={breakMins} onChange={e=>setBreakMins(e.target.value)} placeholder="0"/>
        <div style={{ marginBottom:16 }}>
          <FormLabel>Notes (optional)</FormLabel>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Anything to flag for your manager…"
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box', color:C.black }}/>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={()=>setOutModal(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmClockOut}>Confirm Clock Out</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── My Time Off ───────────────────────────────────────────────
function MyTimeOffPage({ profile, toast }) {
  const [requests, setRequests] = useState([])
  const [holidays, setHolidays] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ leaveType:'vacation', startDate:'', endDate:'', notes:'' })
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ load() }, [profile.id])

  async function load() {
    try {
      const [reqs, hols] = await Promise.all([getTimeOffForEmployee(profile.id), getHolidays()])
      setRequests(reqs||[]); setHolidays(hols||[])
    } catch(e){ toast(e.message,'error') }
    finally { setLoading(false) }
  }

  async function handleSubmit() {
    if (!form.startDate||!form.endDate){ toast('Please select dates','error'); return }
    const start = new Date(form.startDate+'T12:00:00'), end = new Date(form.endDate+'T12:00:00')
    const days = Math.round((end-start)/86400000)+1
    const holDates = holidays.map(h=>h.date)
    let daysReq = 0
    for (let i=0;i<days;i++) {
      const d = new Date(start); d.setDate(d.getDate()+i)
      const ds = d.toISOString().split('T')[0], dow = d.getDay()
      if (dow!==0&&dow!==6&&!holDates.includes(ds)) daysReq++
    }
    try {
      await submitTimeOff({ employeeId:profile.id, leaveType:form.leaveType, startDate:form.startDate, endDate:form.endDate, daysRequested:daysReq, notes:form.notes })
      toast('Request submitted'); setModal(false)
      setForm({ leaveType:'vacation', startDate:'', endDate:'', notes:'' }); load()
    } catch(e){ toast(e.message,'error') }
  }

  const balance = (profile.pto_balance||15) - (profile.pto_used||0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Time Off</div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:3 }}>{balance} days remaining</div>
        </div>
        <Btn onClick={()=>setModal(true)}>+ New Request</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="PTO Balance" value={balance} sub={`of ${profile.pto_balance||15} annual days`}/>
        <StatCard label="PTO Used" value={profile.pto_used||0} sub="this year"/>
        <StatCard label="Pending" value={requests.filter(r=>r.status==='pending').length} sub="awaiting approval"/>
      </div>

      <Card>
        <CardHeader title="My Requests"/>
        {loading ? <div style={{ color:C.lightGray, fontSize:13 }}>Loading…</div> :
         requests.length===0 ? <div style={{ textAlign:'center', padding:'32px 0', color:C.lightGray, fontSize:13 }}>No requests yet</div> :
         requests.map(r=>(
          <div key={r.id} style={{ borderBottom:`1px solid ${C.offWhite}`, padding:'14px 0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontWeight:500, textTransform:'capitalize', color:C.black }}>{r.leave_type}</span>
              <Badge variant={r.status==='approved'?'approved':r.status==='denied'?'flagged':'pending'}>{r.status}</Badge>
            </div>
            <div style={{ fontSize:13, color:C.midGray }}>
              {new Date(r.start_date+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
              {r.start_date!==r.end_date && ` – ${new Date(r.end_date+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
              {' '}· {r.days_requested} day{r.days_requested!==1?'s':''}
            </div>
            {r.notes && <div style={{ fontSize:12, color:C.lightGray, marginTop:3 }}>{r.notes}</div>}
            {r.denial_reason && <div style={{ fontSize:12, color:'#cc4444', marginTop:3 }}>Reason: {r.denial_reason}</div>}
          </div>
        ))}
      </Card>

      <Modal open={modal} onClose={()=>setModal(false)} title="New Time Off Request">
        <Select label="Leave Type" value={form.leaveType} onChange={e=>setForm(f=>({...f,leaveType:e.target.value}))}>
          <option value="vacation">Vacation</option>
          <option value="sick">Sick Leave</option>
          <option value="personal">Personal</option>
          <option value="bereavement">Bereavement</option>
        </Select>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Start Date" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/>
          <Input label="End Date" type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
        </div>
        <div style={{ background:C.offWhite, border:`1px solid ${C.silver}`, borderRadius:5, padding:'10px 14px', fontSize:12, color:C.midGray, marginBottom:16, letterSpacing:.2 }}>
          Holidays within your selected dates will not be deducted from your PTO balance.
        </div>
        <div style={{ marginBottom:16 }}>
          <FormLabel>Notes (optional)</FormLabel>
          <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any context for your manager…"
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={()=>setModal(false)}>Cancel</Btn>
          <Btn onClick={handleSubmit}>Submit Request</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── Admin Dashboard ───────────────────────────────────────────
function AdminDashboard({ profile, toast }) {
  const [clockedIn, setClockedIn] = useState([])
  const [pendingTO, setPendingTO] = useState([])
  const [pendingTS, setPendingTS] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ load() }, [])

  async function load() {
    try {
      const [ci,to,ts] = await Promise.all([getClockedInNow(), getAllTimeOff({status:'pending'}), getAllEntries({status:'pending'})])
      setClockedIn(ci||[]); setPendingTO(to||[]); setPendingTS(ts||[])
    } catch(e){ toast(e.message,'error') }
    finally { setLoading(false) }
  }

  async function approveTO(id){ try{ await reviewTimeOff(id,{status:'approved',reviewerId:profile.id}); toast('Approved'); load() }catch(e){toast(e.message,'error')} }
  async function denyTO(id){   try{ await reviewTimeOff(id,{status:'denied',reviewerId:profile.id});   toast('Denied');   load() }catch(e){toast(e.message,'error')} }
  async function approveTS(id){ try{ await approveEntry(id,profile.id); toast('Timesheet approved'); load() }catch(e){toast(e.message,'error')} }
  async function flagTS(id){    try{ await flagEntry(id);               toast('Entry flagged');      load() }catch(e){toast(e.message,'error')} }

  return (
    <div>
      <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4, marginBottom:4 }}>Dashboard</div>
      <div style={{ fontSize:12, color:C.lightGray, marginBottom:22, textTransform:'uppercase', letterSpacing:.5 }}>{fmtDateLong(new Date())}</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
        <StatCard label="Clocked In" value={clockedIn.length} sub="working now"/>
        <StatCard label="Remote" value={clockedIn.filter(e=>e.location==='remote').length} sub="of clocked-in"/>
        <StatCard label="Timesheets" value={pendingTS.length} sub="need approval"/>
        <StatCard label="Time Off" value={pendingTO.length} sub="need review"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Live activity */}
        <Card>
          <CardHeader title="Live — Clocked In"/>
          {loading ? <div style={{color:C.lightGray,fontSize:13}}>Loading…</div> :
           clockedIn.length===0 ? <div style={{color:C.lightGray,fontSize:13}}>Nobody clocked in</div> :
           clockedIn.map(e=>(
            <div key={e.entry_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${C.offWhite}` }}>
              <Avatar first={e.full_name?.split(' ')[0]} last={e.full_name?.split(' ')[1]} size={30}/>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{e.full_name}</div>
                <div style={{ fontSize:11, color:C.lightGray, textTransform:'uppercase', letterSpacing:.3 }}>{e.department} · {e.location}</div>
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, color:C.midGray }}>{formatHours(e.hours_so_far)}</div>
            </div>
          ))}
        </Card>

        {/* Pending time off */}
        <Card>
          <CardHeader title="Pending Time Off"/>
          {loading ? <div style={{color:C.lightGray,fontSize:13}}>Loading…</div> :
           pendingTO.length===0 ? <div style={{color:C.lightGray,fontSize:13}}>No pending requests</div> :
           pendingTO.map(r=>(
            <div key={r.id} style={{ border:`1px solid ${C.silver}`, borderRadius:6, padding:'12px 14px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontWeight:500, fontSize:13 }}>{r.profiles?.first_name} {r.profiles?.last_name}</span>
                <Badge variant="pending">Pending</Badge>
              </div>
              <div style={{ fontSize:12, color:C.midGray, marginBottom:10, textTransform:'capitalize' }}>
                {r.leave_type} · {new Date(r.start_date+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                {r.start_date!==r.end_date && ` – ${new Date(r.end_date+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
                {' '}({r.days_requested}d)
              </div>
              <div style={{ display:'flex', gap:7 }}>
                <Btn size="sm" onClick={()=>approveTO(r.id)}>Approve</Btn>
                <Btn size="sm" variant="danger" onClick={()=>denyTO(r.id)}>Deny</Btn>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Pending timesheets */}
      <Card>
        <CardHeader title="Pending Timesheets"/>
        {loading ? <div style={{color:C.lightGray,fontSize:13}}>Loading…</div> :
         pendingTS.length===0 ? <div style={{ textAlign:'center', padding:'24px 0', color:C.lightGray, fontSize:13 }}>All caught up — no pending timesheets</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr>{['Employee','Dept','Date','Location','In','Out','Hours','Action'].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {pendingTS.map(e=>(
                  <tr key={e.id}>
                    <TD style={{ fontWeight:500 }}>{e.profiles?.first_name} {e.profiles?.last_name}</TD>
                    <TD style={{ color:C.midGray, fontSize:12 }}>{e.profiles?.department}</TD>
                    <TD style={{ fontSize:12 }}>{formatDate(e.clock_in)}</TD>
                    <TD style={{ fontSize:11, color:C.midGray, textTransform:'uppercase', letterSpacing:.3 }}>{e.location||'—'}</TD>
                    <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_in)}</TD>
                    <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_out)}</TD>
                    <TD style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>{formatHours(calcHours(e.clock_in,e.clock_out,e.break_mins))}</TD>
                    <TD><div style={{display:'flex',gap:6}}><Btn size="sm" onClick={()=>approveTS(e.id)}>✓</Btn><Btn size="sm" variant="danger" onClick={()=>flagTS(e.id)}>⚑</Btn></div></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Timesheets Page ───────────────────────────────────────────
function TimesheetsPage({ profile, toast }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('pending')
  const [weekOf, setWeekOf] = useState(weekStart().toISOString().split('T')[0])

  useEffect(()=>{ load() }, [status, weekOf])

  async function load() {
    setLoading(true)
    try {
      const from = new Date(weekOf+'T00:00:00').toISOString()
      const to   = new Date(new Date(weekOf).getTime()+7*86400000).toISOString()
      const data = await getAllEntries({ from, to, status: status==='all'?undefined:status })
      setEntries(data||[])
    } catch(e){ toast(e.message,'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Timesheets</div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:3 }}>Review and approve employee time</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={weekOf} onChange={e=>setWeekOf(e.target.value)}
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'8px 11px', fontFamily:'var(--font)', fontSize:12, color:C.black }}/>
          <select value={status} onChange={e=>setStatus(e.target.value)}
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'8px 11px', fontFamily:'var(--font)', fontSize:12, color:C.black }}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      <Card>
        {loading ? <div style={{color:C.lightGray,fontSize:13}}>Loading…</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr>{['Employee','Dept','Date','Location','In','Out','Break','Hours','Status','Action'].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {entries.length===0 && <tr><TD colSpan={10} style={{textAlign:'center',color:C.lightGray,padding:32}}>No entries found</TD></tr>}
                {entries.map(e=>(
                  <tr key={e.id}>
                    <TD style={{fontWeight:500}}>{e.profiles?.first_name} {e.profiles?.last_name}</TD>
                    <TD style={{color:C.midGray,fontSize:12}}>{e.profiles?.department}</TD>
                    <TD style={{fontSize:12}}>{formatDate(e.clock_in)}</TD>
                    <TD style={{fontSize:11,color:C.midGray,textTransform:'uppercase',letterSpacing:.3}}>{e.location||'—'}</TD>
                    <TD style={{fontFamily:'var(--mono)',fontSize:12}}>{formatTime(e.clock_in)}</TD>
                    <TD style={{fontFamily:'var(--mono)',fontSize:12}}>{formatTime(e.clock_out)}</TD>
                    <TD style={{fontFamily:'var(--mono)',fontSize:12,color:C.midGray}}>{e.break_mins?`${e.break_mins}m`:'—'}</TD>
                    <TD style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:500}}>{formatHours(calcHours(e.clock_in,e.clock_out,e.break_mins))}</TD>
                    <TD><Badge variant={e.status==='approved'?'approved':e.status==='flagged'?'flagged':e.status==='active'?'active':'pending'}>{e.status}</Badge></TD>
                    <TD>
                      {e.status==='pending'&&(
                        <div style={{display:'flex',gap:5}}>
                          <Btn size="sm" onClick={async()=>{await approveEntry(e.id,profile.id);toast('Approved');load()}}>✓</Btn>
                          <Btn size="sm" variant="danger" onClick={async()=>{await flagEntry(e.id);toast('Flagged');load()}}>⚑</Btn>
                        </div>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Holidays Page ─────────────────────────────────────────────
function HolidaysPage({ profile, toast }) {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name:'', date:'', type:'federal', applies_to:'all', paid_hours:8 })
  const isManager = ['admin','manager'].includes(profile.role)
  const today = new Date().toISOString().split('T')[0]

  useEffect(()=>{ load() },[])
  async function load() {
    try { setHolidays(await getHolidays()) } catch(e){toast(e.message,'error')} finally{setLoading(false)}
  }
  async function handleAdd() {
    if (!form.name||!form.date){toast('Name and date required','error');return}
    try {
      await addHoliday({...form, paid_hours:parseInt(form.paid_hours)})
      toast(`${form.name} added`); setModal(false)
      setForm({name:'',date:'',type:'federal',applies_to:'all',paid_hours:8}); load()
    } catch(e){toast(e.message,'error')}
  }
  async function handleDelete(id,name) {
    if (!confirm(`Remove "${name}"?`)) return
    try { await deleteHoliday(id); toast('Removed'); load() } catch(e){toast(e.message,'error')}
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Holidays</div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:3 }}>Auto-applied to timesheets as paid hours</div>
        </div>
        {isManager && <Btn onClick={()=>setModal(true)}>+ Add Holiday</Btn>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total 2026" value={holidays.length} sub="calendar year"/>
        <StatCard label="Upcoming" value={holidays.filter(h=>!h.past&&h.date>=today).length} sub="remaining this year"/>
        <StatCard label="Paid Hours" value={holidays.reduce((s,h)=>s+h.paid_hours,0)} sub="total per employee"/>
      </div>

      <Card>
        <CardHeader title="2026 Calendar"/>
        {loading ? <div style={{color:C.lightGray,fontSize:13}}>Loading…</div> :
         holidays.map(h=>{
          const isPast = h.date < today
          const isUp = !isPast && h.date <= new Date(Date.now()+30*86400000).toISOString().split('T')[0]
          const d = new Date(h.date+'T12:00')
          return (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 0', borderBottom:`1px solid ${C.offWhite}`, opacity:isPast?.6:1 }}>
              <div style={{
                width:46, height:46, borderRadius:6, flexShrink:0,
                background: isUp ? C.black : isPast ? C.offWhite : C.charcoal,
                color: isUp ? C.white : isPast ? C.lightGray : C.lightGray,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                fontSize:9, fontFamily:'var(--mono)', fontWeight:600, lineHeight:1.4, letterSpacing:.5,
              }}>
                {d.toLocaleDateString('en-US',{month:'short'}).toUpperCase()}<br/>{d.getDate()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, color: isPast?C.midGray:C.black }}>{h.name}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                  <Badge variant={h.type==='federal'?'active':h.type==='company'?'approved':'pending'}>{h.type}</Badge>
                  <span style={{ fontSize:11, color:C.lightGray }}>{h.paid_hours}h paid · {h.applies_to==='all'?'All employees':h.applies_to}</span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {isUp && <Badge variant="upcoming">Upcoming</Badge>}
                {isPast && <Badge variant="past">Past</Badge>}
                {isManager && <button onClick={()=>handleDelete(h.id,h.name)} style={{ border:'none', background:'none', cursor:'pointer', color:C.lightGray, fontSize:18, padding:'2px 8px', borderRadius:4 }}>×</button>}
              </div>
            </div>
          )
         })}
      </Card>

      <Modal open={modal} onClose={()=>setModal(false)} title="Add Holiday">
        <Input label="Holiday Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Independence Day"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Date" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          <Select label="Type" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            <option value="federal">Federal</option><option value="company">Company</option><option value="state">State/Regional</option>
          </Select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Select label="Applies To" value={form.applies_to} onChange={e=>setForm(f=>({...f,applies_to:e.target.value}))}>
            <option value="all">All Employees</option><option value="fulltime">Full-time Only</option>
          </Select>
          <Select label="Paid Hours" value={form.paid_hours} onChange={e=>setForm(f=>({...f,paid_hours:e.target.value}))}>
            <option value="8">8h (full day)</option><option value="4">4h (half day)</option><option value="0">0h (unpaid)</option>
          </Select>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={()=>setModal(false)}>Cancel</Btn>
          <Btn onClick={handleAdd}>Add Holiday</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── Employees Page ────────────────────────────────────────────
function EmployeesPage({ profile, toast }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [inviteModal, setInviteModal] = useState(false)
  const [form, setForm] = useState({ email:'', firstName:'', lastName:'', role:'employee', department:'', type:'fulltime' })

  useEffect(()=>{ load() },[])
  async function load() { try{setEmployees(await getAllEmployees())}catch(e){toast(e.message,'error')}finally{setLoading(false)} }

  const filtered = employees.filter(e=> !search || `${e.first_name} ${e.last_name} ${e.department}`.toLowerCase().includes(search.toLowerCase()))

  async function handleInvite() {
    if (!form.email||!form.firstName||!form.lastName){toast('All fields required','error');return}
    try {
      const {data,error} = await getClient().auth.signUp({
        email:form.email, password:Math.random().toString(36).slice(2,14),
        options:{data:{first_name:form.firstName,last_name:form.lastName,role:form.role}}
      })
      if (error) throw error
      toast(`Invite sent to ${form.email}`)
      setInviteModal(false)
      setForm({email:'',firstName:'',lastName:'',role:'employee',department:'',type:'fulltime'})
      setTimeout(load, 1000)
    } catch(e){toast(e.message,'error')}
  }

  const typeLabel = { fulltime:'Full-time', parttime:'Part-time', contractor:'Contractor' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Employees</div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:3 }}>{employees.length} active employees</div>
        </div>
        <Btn onClick={()=>setInviteModal(true)}>+ Invite Employee</Btn>
      </div>
      <Card>
        <div style={{ marginBottom:16 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or department…"
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'8px 12px 8px 32px', fontFamily:'var(--font)', fontSize:13, width:280, backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23a8a8a8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'10px center' }}/>
        </div>
        {loading ? <div style={{color:C.lightGray,fontSize:13}}>Loading…</div> : (
          <div style={{overflowX:'auto'}}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr>{['Employee','Department','Type','Role','Status','Holiday Pay'].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {filtered.map(e=>(
                  <tr key={e.id}>
                    <TD>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Avatar first={e.first_name} last={e.last_name} size={30}/>
                        <div>
                          <div style={{ fontWeight:500 }}>{e.first_name} {e.last_name}</div>
                          <div style={{ fontSize:11, color:C.lightGray }}>{e.email}</div>
                        </div>
                      </div>
                    </TD>
                    <TD style={{color:C.midGray}}>{e.department||'—'}</TD>
                    <TD>{typeLabel[e.employment_type]||e.employment_type}</TD>
                    <TD><Badge variant={e.role==='admin'?'admin':e.role==='manager'?'manager':'employee'}>{e.role}</Badge></TD>
                    <TD><Badge variant={e.is_active?'approved':'past'}>{e.is_active?'Active':'Inactive'}</Badge></TD>
                    <TD><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.midGray }}>{e.employment_type==='fulltime'?'8h / holiday':'Pro-rata'}</span></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={inviteModal} onClose={()=>setInviteModal(false)} title="Invite Employee">
        <div style={{ background:C.offWhite, border:`1px solid ${C.silver}`, borderRadius:5, padding:'10px 14px', fontSize:12, color:C.midGray, marginBottom:18 }}>
          An email invitation will be sent. The employee sets their own password.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="First Name" value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} placeholder="Jane"/>
          <Input label="Last Name" value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} placeholder="Smith"/>
        </div>
        <Input label="Work Email" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="jane@company.com"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Department" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="Engineering"/>
          <Select label="Role" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
          </Select>
        </div>
        <Select label="Employment Type" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
          <option value="fulltime">Full-time</option><option value="parttime">Part-time</option><option value="contractor">Contractor</option>
        </Select>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={()=>setInviteModal(false)}>Cancel</Btn>
          <Btn onClick={handleInvite}>Send Invitation</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── Profile Page ──────────────────────────────────────────────
function ProfilePage({ profile, toast, onUpdate }) {
  const [form, setForm] = useState({ first_name:profile.first_name, last_name:profile.last_name, department:profile.department||'' })
  const [newPw, setNewPw] = useState(''); const [confirmPw, setConfirmPw] = useState('')

  async function handleSave() {
    try {
      const { updateProfile } = await import('../lib/db')
      await updateProfile(profile.id, form)
      onUpdate({...profile,...form}); toast('Profile updated')
    } catch(e){toast(e.message,'error')}
  }

  async function handlePw() {
    if (newPw!==confirmPw){toast('Passwords do not match','error');return}
    if (newPw.length<8){toast('At least 8 characters required','error');return}
    try {
      const {error} = await getClient().auth.updateUser({password:newPw})
      if(error) throw error
      setNewPw(''); setConfirmPw(''); toast('Password updated')
    } catch(e){toast(e.message,'error')}
  }

  return (
    <div style={{ maxWidth:520 }}>
      <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4, marginBottom:20 }}>My Profile</div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:22, paddingBottom:22, borderBottom:`1px solid ${C.offWhite}` }}>
          <Avatar first={profile.first_name} last={profile.last_name} size={56}/>
          <div>
            <div style={{ fontWeight:600, fontSize:16 }}>{profile.first_name} {profile.last_name}</div>
            <div style={{ fontSize:13, color:C.midGray, margin:'3px 0 6px' }}>{profile.email}</div>
            <Badge variant={profile.role==='admin'?'admin':profile.role==='manager'?'manager':'employee'}>{profile.role}</Badge>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="First Name" value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))}/>
          <Input label="Last Name" value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))}/>
        </div>
        <Input label="Department" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))}/>
        <div style={{ display:'flex', justifyContent:'flex-end' }}><Btn onClick={handleSave}>Save Changes</Btn></div>
      </Card>
      <Card>
        <CardHeader title="Change Password"/>
        <Input label="New Password" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="At least 8 characters"/>
        <Input label="Confirm Password" type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} placeholder="Re-enter new password"/>
        <div style={{ display:'flex', justifyContent:'flex-end' }}><Btn onClick={handlePw}>Update Password</Btn></div>
      </Card>
    </div>
  )
}

// ─── Pay Periods Page ─────────────────────────────────────────
function PayPeriodsPage({ profile, toast }) {
  const isManager = ['admin','manager'].includes(profile.role)

  // Generate bi-weekly pay periods
  // Anchor: period starting 12/28/2025, ending 01/10/2026, payday 01/14/2026
  // Payday is always 4 days after period end
  function generatePeriods() {
    const anchor = new Date('2025-12-28T12:00:00')
    const periods = []
    const today = new Date()
    let start = new Date(anchor)
    for (let i = 0; i < 52; i++) {
      const end = new Date(start)
      end.setDate(end.getDate() + 13) // 14-day period (day 0 to day 13)
      const payday = new Date(end)
      payday.setDate(payday.getDate() + 4) // Payday 4 days after period end
      periods.push({ start: new Date(start), end: new Date(end), payday: new Date(payday) })
      start.setDate(start.getDate() + 14)
    }
    // Return periods sorted newest first, only up to 1 future period
    return periods
      .filter(p => p.start <= new Date(today.getTime() + 14 * 86400000))
      .reverse()
  }

  const periods = generatePeriods()
  const today = new Date()

  function isCurrent(p) {
    return p.start <= today && today <= p.end
  }

  function isPending(p) {
    // Period ended but payday hasn't arrived yet
    return p.end < today && today < p.payday
  }

  function fmtPeriod(p) {
    const opts = { month: 'short', day: 'numeric' }
    return `${p.start.toLocaleDateString('en-US', opts)} – ${p.end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }

  function fmtPayday(p) {
    return p.payday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const [selectedPeriod, setSelectedPeriod] = useState(periods[0] || null)
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (selectedPeriod) loadEntries(selectedPeriod) }, [selectedPeriod])

  async function loadEntries(period) {
    setLoading(true)
    try {
      const sb = getClient()
      let q = sb.from('time_entries')
        .select('*, profiles!time_entries_employee_id_fkey(first_name, last_name, department, employment_type, hourly_rate)')
        .gte('clock_in', period.start.toISOString())
        .lte('clock_in', new Date(period.end.getTime() + 86400000).toISOString())
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: true })

      // Employees only see their own
      if (!isManager) q = q.eq('employee_id', profile.id)

      const { data, error } = await q
      if (error) throw error
      setEntries(data || [])

      // Group by employee for summary
      const empMap = {}
      ;(data || []).forEach(e => {
        const id = e.employee_id
        if (!empMap[id]) {
          empMap[id] = {
            id,
            name: `${e.profiles?.first_name || ''} ${e.profiles?.last_name || ''}`.trim(),
            dept: e.profiles?.department || '—',
            entries: [],
            totalMins: 0,
          }
        }
        const mins = ((new Date(e.clock_out) - new Date(e.clock_in)) / 60000) - (e.break_mins || 0)
        empMap[id].entries.push(e)
        empMap[id].totalMins += Math.max(0, mins)
      })
      setEmployees(Object.values(empMap))
    } catch(e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  function fmtHrs(mins) {
    const h = Math.floor(mins / 60), m = Math.round(mins % 60)
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim()
  }

  function exportCSV() {
    if (!entries.length) { toast('No entries to export', 'error'); return }

    // Build CSV rows
    const periodLabel = fmtPeriod(selectedPeriod)
    const paydayLabel = fmtPayday(selectedPeriod)
    const rows = [
      [`Pay Period: ${periodLabel}`],
      [`Payday: ${paydayLabel}`],
      [],
      ['Employee', 'Department', 'Date', 'Clock In', 'Clock Out', 'Break (min)', 'Hours', 'Status']
    ]
    entries.forEach(e => {
      const hrs = ((new Date(e.clock_out) - new Date(e.clock_in)) / 3600000) - (e.break_mins || 0) / 60
      rows.push([
        `${e.profiles?.first_name || ''} ${e.profiles?.last_name || ''}`.trim(),
        e.profiles?.department || '',
        new Date(e.clock_in).toLocaleDateString('en-US'),
        formatTime(e.clock_in),
        formatTime(e.clock_out),
        e.break_mins || 0,
        Math.max(0, hrs).toFixed(2),
        e.status,
      ])
    })

    // Add summary rows
    rows.push([])
    rows.push(['SUMMARY'])
    rows.push(['Employee', 'Department', 'Total Hours'])
    employees.forEach(emp => {
      rows.push([emp.name, emp.dept, (emp.totalMins / 60).toFixed(2)])
    })

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payperiod-${selectedPeriod.start.toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('CSV downloaded')
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Pay Periods</div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:3 }}>Bi-weekly · {isManager ? 'All employees' : 'My timesheet'}</div>
        </div>
        <Btn onClick={exportCSV}>↓ Export CSV</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:16, alignItems:'start' }}>

        {/* Period selector */}
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.silver}`, fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.8, color:C.lightGray }}>
            Select Period
          </div>
          <div style={{ maxHeight:480, overflowY:'auto' }}>
            {periods.map((p, i) => {
              const current = isCurrent(p)
              const selected = selectedPeriod && p.start.getTime() === selectedPeriod.start.getTime()
              return (
                <div key={i} onClick={() => setSelectedPeriod(p)} style={{
                  padding:'12px 16px', cursor:'pointer', borderBottom:`1px solid ${C.offWhite}`,
                  background: selected ? C.black : 'transparent',
                  color: selected ? C.white : C.text,
                  transition:'all .12s',
                }}>
                  <div style={{ fontSize:13, fontWeight: current || selected ? 600 : 400 }}>
                    {fmtPeriod(p)}
                  </div>
                  <div style={{ fontSize:10, marginTop:3, color: selected ? '#aaa' : C.lightGray, letterSpacing:.3 }}>
                    Payday: {fmtPayday(p)}
                  </div>
                  {current && (
                    <div style={{ fontSize:10, marginTop:2, color: selected ? '#6fcf97' : C.midGray, textTransform:'uppercase', letterSpacing:.5, fontWeight:600 }}>
                      ● Current Period
                    </div>
                  )}
                  {!current && isPending(p) && (
                    <div style={{ fontSize:10, marginTop:2, color: selected ? '#f0c060' : C.midGray, textTransform:'uppercase', letterSpacing:.5, fontWeight:600 }}>
                      ● Awaiting Payday
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Period detail */}
        <div>
          {selectedPeriod && (
            <>
              {/* Summary cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
                <StatCard
                  label="Period"
                  value={fmtPeriod(selectedPeriod).split('–')[0].trim()}
                  sub={`ends ${fmtPeriod(selectedPeriod).split('–')[1].trim()}`}
                />
                <StatCard
                  label="Payday"
                  value={selectedPeriod.payday.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  sub={selectedPeriod.payday.getFullYear()}
                />
                <StatCard
                  label="Total Hours"
                  value={fmtHrs(employees.reduce((s,e)=>s+e.totalMins,0))}
                  sub={`across ${employees.length} employee${employees.length!==1?'s':''}`}
                />
                <StatCard
                  label="Entries"
                  value={entries.length}
                  sub="clock-in records"
                />
              </div>

              {/* Employee summary */}
              {isManager && employees.length > 0 && (
                <Card style={{ marginBottom:16 }}>
                  <CardHeader title="Employee Summary"/>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr>{['Employee','Department','Shifts','Total Hours'].map(h=><TH key={h}>{h}</TH>)}</tr>
                      </thead>
                      <tbody>
                        {employees.map(emp => (
                          <tr key={emp.id}>
                            <TD style={{ fontWeight:500 }}>{emp.name}</TD>
                            <TD style={{ color:C.midGray }}>{emp.dept}</TD>
                            <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{emp.entries.length}</TD>
                            <TD style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>{fmtHrs(emp.totalMins)}</TD>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr style={{ borderTop:`2px solid ${C.silver}` }}>
                          <TD style={{ fontWeight:600 }}>Total</TD>
                          <TD/>
                          <TD style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>{entries.length}</TD>
                          <TD style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>
                            {fmtHrs(employees.reduce((s,e)=>s+e.totalMins,0))}
                          </TD>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Detailed entries */}
              <Card>
                <CardHeader
                  title={`All Entries · ${fmtPeriod(selectedPeriod)}`}
                  right={loading ? 'Loading…' : `${entries.length} entries`}
                />
                {loading ? (
                  <div style={{ color:C.lightGray, fontSize:13, padding:'20px 0', textAlign:'center' }}>Loading…</div>
                ) : entries.length === 0 ? (
                  <div style={{ color:C.lightGray, fontSize:13, padding:'32px 0', textAlign:'center' }}>
                    No entries for this pay period
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr>
                          {[
                            ...(isManager ? ['Employee'] : []),
                            'Date','Location','Clock In','Clock Out','Break','Hours','Status'
                          ].map(h=><TH key={h}>{h}</TH>)}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(e => {
                          const hrs = ((new Date(e.clock_out) - new Date(e.clock_in)) / 3600000) - (e.break_mins||0)/60
                          return (
                            <tr key={e.id}>
                              {isManager && (
                                <TD style={{ fontWeight:500 }}>
                                  {e.profiles?.first_name} {e.profiles?.last_name}
                                </TD>
                              )}
                              <TD style={{ fontSize:12 }}>{formatDate(e.clock_in)}</TD>
                              <TD style={{ fontSize:11, color:C.midGray, textTransform:'uppercase', letterSpacing:.3 }}>{e.location||'—'}</TD>
                              <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_in)}</TD>
                              <TD style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_out)}</TD>
                              <TD style={{ fontFamily:'var(--mono)', fontSize:12, color:C.midGray }}>{e.break_mins ? `${e.break_mins}m` : '—'}</TD>
                              <TD style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600 }}>{Math.max(0,hrs).toFixed(2)}h</TD>
                              <TD><Badge variant={e.status==='approved'?'approved':e.status==='flagged'?'flagged':e.status==='active'?'active':'pending'}>{e.status}</Badge></TD>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── PTO Page ─────────────────────────────────────────────────
function PTOPage({ profile, toast }) {
  const isManager = ['admin','manager'].includes(profile.role)
  const sb = getClient()

  // Views
  const [tab, setTab] = useState('my')        // 'my' | 'all'
  const [typeTab, setTypeTab] = useState('pto') // 'pto' | 'bereavement'

  // Data
  const [myLedger, setMyLedger] = useState({ pto: [], bereavement: [] })
  const [myBal, setMyBal] = useState({ pto: 0, bereavement: 0 })
  const [allBalances, setAllBalances] = useState([])
  const [allLedger, setAllLedger] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [openingModal, setOpeningModal] = useState(false)
  const [accrualModal, setAccrualModal] = useState(false)
  const [adjustModal, setAdjustModal] = useState(false)
  const [openingForm, setOpeningForm] = useState({ employeeId: profile.id, ptoHours: '', bereavementHours: '' })
  const [adjustForm, setAdjustForm] = useState({ employeeId: '', leaveType: 'pto', hours: '', notes: '' })

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    try {
      if (isManager) {
        const { data: emps } = await sb.from('profiles').select('id,first_name,last_name').eq('is_active',true).order('first_name')
        setEmployees(emps||[])
      }

      if (tab === 'my' || !isManager) {
        const { data: rows } = await sb.from('pto_ledger')
          .select('*').eq('employee_id', profile.id)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
        const ptoRows = (rows||[]).filter(r => r.leave_type === 'pto')
        const berRows = (rows||[]).filter(r => r.leave_type === 'bereavement')
        setMyLedger({ pto: ptoRows, bereavement: berRows })
        setMyBal({
          pto: (rows||[]).filter(r=>r.leave_type==='pto').reduce((s,r)=>s+parseFloat(r.hours),0),
          bereavement: (rows||[]).filter(r=>r.leave_type==='bereavement').reduce((s,r)=>s+parseFloat(r.hours),0)
        })
      }

      if (tab === 'all' && isManager) {
        const { data: bals } = await sb.from('pto_balances').select('*').order('full_name')
        setAllBalances(bals||[])
        const { data: ledger } = await sb.from('pto_ledger')
          .select('*, profiles!pto_ledger_employee_id_fkey(first_name,last_name)')
          .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(150)
        setAllLedger(ledger||[])
      }
    } catch(e) { toast(e.message,'error') }
    finally { setLoading(false) }
  }

  async function getBalance(empId, ltype) {
    const { data } = await sb.from('pto_ledger').select('hours').eq('employee_id',empId).eq('leave_type',ltype)
    return (data||[]).reduce((s,r)=>s+parseFloat(r.hours),0)
  }

  // Set opening balances for one employee
  async function handleSetOpening() {
    const { employeeId, ptoHours, bereavementHours } = openingForm
    if (!employeeId) { toast('Select an employee','error'); return }
    const today = new Date().toISOString().split('T')[0]
    try {
      const ops = []
      if (ptoHours !== '') {
        const h = parseFloat(ptoHours)
        // Delete any existing opening entry for this employee+type first
        await sb.from('pto_ledger').delete().eq('employee_id',employeeId).eq('leave_type','pto').eq('entry_type','opening')
        // Recalculate balance: opening + everything else
        const rest = await getBalance(employeeId,'pto')
        ops.push(sb.from('pto_ledger').insert({
          employee_id: employeeId, leave_type: 'pto', entry_date: today,
          entry_type: 'opening', hours: h, balance_after: h,
          notes: 'Opening balance set by manager', created_by: profile.id
        }))
      }
      if (bereavementHours !== '') {
        const h = parseFloat(bereavementHours)
        await sb.from('pto_ledger').delete().eq('employee_id',employeeId).eq('leave_type','bereavement').eq('entry_type','opening')
        ops.push(sb.from('pto_ledger').insert({
          employee_id: employeeId, leave_type: 'bereavement', entry_date: today,
          entry_type: 'opening', hours: h, balance_after: h,
          notes: 'Opening balance set by manager', created_by: profile.id
        }))
      }
      await Promise.all(ops)
      toast('Opening balances saved')
      setOpeningModal(false)
      setOpeningForm({ employeeId: profile.id, ptoHours: '', bereavementHours: '' })
      load()
    } catch(e) { toast(e.message,'error') }
  }

  // Run bi-weekly PTO accrual for all employees
  async function runAccrual() {
    try {
      const { data: settings } = await sb.from('pto_settings').select('*,profiles!pto_settings_employee_id_fkey(first_name,last_name)').eq('accrual_active',true)
      if (!settings?.length) { toast('No active employees','error'); return }
      const today = new Date().toISOString().split('T')[0]
      let count = 0
      for (const s of settings) {
        const bal = await getBalance(s.employee_id,'pto')
        const newBal = bal + parseFloat(s.pto_accrual_hours)
        await sb.from('pto_ledger').insert({
          employee_id: s.employee_id, leave_type: 'pto',
          entry_date: today, entry_type: 'accrual',
          hours: parseFloat(s.pto_accrual_hours), balance_after: newBal,
          pay_period_start: today,
          notes: `Bi-weekly accrual (${s.pto_accrual_hours}h)`, created_by: profile.id
        })
        count++
      }
      toast(`Accrued ${count} employees — 6.46h PTO each`)
      setAccrualModal(false)
      load()
    } catch(e) { toast(e.message,'error') }
  }

  // Grant annual bereavement hours (Jan 1 each year)
  async function grantBereavement() {
    try {
      const { data: settings } = await sb.from('pto_settings').select('*').eq('accrual_active',true)
      const year = new Date().getFullYear()
      const grantDate = `${year}-01-01`
      let count = 0
      for (const s of settings) {
        // Check if already granted this year
        const { data: existing } = await sb.from('pto_ledger')
          .select('id').eq('employee_id',s.employee_id).eq('leave_type','bereavement')
          .eq('entry_type','grant').gte('entry_date',`${year}-01-01`).lte('entry_date',`${year}-12-31`)
        if (existing?.length) continue
        const bal = await getBalance(s.employee_id,'bereavement')
        await sb.from('pto_ledger').insert({
          employee_id: s.employee_id, leave_type: 'bereavement',
          entry_date: grantDate, entry_type: 'grant',
          hours: parseFloat(s.bereavement_annual), balance_after: bal + parseFloat(s.bereavement_annual),
          notes: `${year} annual bereavement grant`, created_by: profile.id
        })
        count++
      }
      toast(count ? `Granted 24h bereavement to ${count} employees` : 'Already granted this year')
      load()
    } catch(e) { toast(e.message,'error') }
  }

  // Manual adjustment
  async function handleAdjust() {
    if (!adjustForm.employeeId || !adjustForm.hours) { toast('Fill in all fields','error'); return }
    try {
      const h = parseFloat(adjustForm.hours)
      const bal = await getBalance(adjustForm.employeeId, adjustForm.leaveType)
      await sb.from('pto_ledger').insert({
        employee_id: adjustForm.employeeId, leave_type: adjustForm.leaveType,
        entry_date: new Date().toISOString().split('T')[0], entry_type: 'adjustment',
        hours: h, balance_after: bal + h,
        notes: adjustForm.notes || 'Manual adjustment', created_by: profile.id
      })
      toast('Adjustment saved')
      setAdjustModal(false)
      setAdjustForm({ employeeId:'', leaveType:'pto', hours:'', notes:'' })
      load()
    } catch(e) { toast(e.message,'error') }
  }

  const entryColor = { opening:'blue', accrual:'approved', grant:'purple', used:'flagged', adjustment:'active', carryover:'pending' }
  const entryLabel = { opening:'Opening', accrual:'Accrual', grant:'Grant', used:'Used', adjustment:'Adjustment', carryover:'Carryover' }

  function LedgerTable({ rows }) {
    if (loading) return <div style={{color:C.lightGray,padding:'20px 0'}}>Loading…</div>
    if (!rows.length) return <div style={{textAlign:'center',color:C.lightGray,padding:'32px 0',fontSize:13}}>No entries yet — set an opening balance to get started.</div>
    return (
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr>{['Date','Type','Hours','Balance After','Notes'].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {rows.map(e=>(
              <tr key={e.id}>
                <TD style={{fontSize:12}}>{new Date(e.entry_date+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</TD>
                <TD><Badge variant={entryColor[e.entry_type]||'default'}>{entryLabel[e.entry_type]||e.entry_type}</Badge></TD>
                <TD style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:500,color:parseFloat(e.hours)>=0?C.black:'#cc4444'}}>
                  {parseFloat(e.hours)>=0?'+':''}{parseFloat(e.hours).toFixed(2)}h
                </TD>
                <TD style={{fontFamily:'var(--mono)',fontSize:12}}>{parseFloat(e.balance_after).toFixed(2)}h</TD>
                <TD style={{fontSize:12,color:C.midGray}}>{e.notes||'—'}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Group allBalances by employee
  const empBalMap = {}
  allBalances.forEach(b => {
    if (!empBalMap[b.employee_id]) empBalMap[b.employee_id] = { name: b.full_name, dept: b.department, pto: null, bereavement: null }
    if (b.leave_type) empBalMap[b.employee_id][b.leave_type] = b
  })
  // Add employees with no ledger entries yet
  employees.forEach(e => {
    if (!empBalMap[e.id]) empBalMap[e.id] = { name:`${e.first_name} ${e.last_name}`, dept:'', pto:null, bereavement:null }
  })

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <div style={{fontSize:22,fontWeight:600,letterSpacing:-.4}}>PTO & Bereavement</div>
          <div style={{fontSize:13,color:C.midGray,marginTop:3}}>PTO: 6.46h/period · Bereavement: 24h/year</div>
        </div>
        {isManager && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <Btn variant="outline" size="sm" onClick={()=>setOpeningModal(true)}>Set Opening Balance</Btn>
            <Btn variant="outline" size="sm" onClick={()=>setAdjustModal(true)}>± Adjust</Btn>
            <Btn size="sm" onClick={()=>setAccrualModal(true)}>▶ Run PTO Accrual</Btn>
            <Btn variant="purple" size="sm" onClick={grantBereavement}>◈ Grant Bereavement</Btn>
          </div>
        )}
      </div>

      {/* Main tab — My vs All */}
      {isManager && (
        <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:7,padding:4,marginBottom:20}}>
          {[{id:'my',label:'My Leave'},{id:'all',label:'All Employees'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1,padding:'7px 14px',border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:13,
              borderRadius:6,transition:'all .14s',
              background:tab===t.id?C.white:'transparent',color:tab===t.id?C.black:C.midGray,
              fontWeight:tab===t.id?500:400,boxShadow:tab===t.id?'0 1px 3px rgba(0,0,0,.08)':'none'
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* MY LEAVE view */}
      {(tab==='my'||!isManager) && (
        <>
          {/* Stat cards */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            <Card>
              <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.8,color:C.lightGray,marginBottom:8}}>PTO Balance</div>
              <div style={{fontSize:36,fontWeight:600,fontFamily:'var(--mono)',letterSpacing:-2,color:C.black}}>{myBal.pto.toFixed(2)}<span style={{fontSize:16,fontWeight:400,color:C.midGray}}> hrs</span></div>
              <div style={{fontSize:12,color:C.midGray,marginTop:4}}>Accrues 6.46h every pay period</div>
            </Card>
            <Card>
              <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.8,color:C.lightGray,marginBottom:8}}>Bereavement Balance</div>
              <div style={{fontSize:36,fontWeight:600,fontFamily:'var(--mono)',letterSpacing:-2,color:C.black}}>{myBal.bereavement.toFixed(2)}<span style={{fontSize:16,fontWeight:400,color:C.midGray}}> hrs</span></div>
              <div style={{fontSize:12,color:C.midGray,marginTop:4}}>24h granted January 1st each year</div>
            </Card>
          </div>

          {/* Type sub-tabs */}
          <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:7,padding:4,marginBottom:16}}>
            {[{id:'pto',label:'PTO Ledger'},{id:'bereavement',label:'Bereavement Ledger'}].map(t=>(
              <button key={t.id} onClick={()=>setTypeTab(t.id)} style={{
                flex:1,padding:'7px 14px',border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:13,
                borderRadius:6,transition:'all .14s',
                background:typeTab===t.id?C.white:'transparent',color:typeTab===t.id?C.black:C.midGray,
                fontWeight:typeTab===t.id?500:400,boxShadow:typeTab===t.id?'0 1px 3px rgba(0,0,0,.08)':'none'
              }}>{t.label}</button>
            ))}
          </div>
          <Card>
            <LedgerTable rows={typeTab==='pto'?myLedger.pto:myLedger.bereavement}/>
          </Card>
        </>
      )}

      {/* ALL EMPLOYEES view */}
      {tab==='all'&&isManager&&(
        <>
          {/* Balance summary table */}
          <Card style={{marginBottom:16}}>
            <CardHeader title="All Employee Balances"/>
            {loading ? <div style={{color:C.lightGray}}>Loading…</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr>
                      {['Employee','Dept','PTO Balance','PTO Used','Bereavement Balance','Bereavement Used'].map(h=><TH key={h}>{h}</TH>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(empBalMap).map(([id,e])=>(
                      <tr key={id}>
                        <TD style={{fontWeight:500}}>{e.name}</TD>
                        <TD style={{color:C.midGray,fontSize:12}}>{e.dept||'—'}</TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:parseFloat(e.pto?.current_balance||0)>0?C.black:'#cc4444'}}>
                          {parseFloat(e.pto?.current_balance||0).toFixed(2)}h
                        </TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12,color:'#cc4444'}}>
                          {parseFloat(e.pto?.total_used||0).toFixed(2)}h
                        </TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:parseFloat(e.bereavement?.current_balance||0)>0?C.black:'#cc4444'}}>
                          {parseFloat(e.bereavement?.current_balance||0).toFixed(2)}h
                        </TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12,color:'#cc4444'}}>
                          {parseFloat(e.bereavement?.total_used||0).toFixed(2)}h
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Full ledger sub-tabs */}
          <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:7,padding:4,marginBottom:16}}>
            {[{id:'pto',label:'PTO Ledger'},{id:'bereavement',label:'Bereavement Ledger'}].map(t=>(
              <button key={t.id} onClick={()=>setTypeTab(t.id)} style={{
                flex:1,padding:'7px 14px',border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:13,
                borderRadius:6,transition:'all .14s',
                background:typeTab===t.id?C.white:'transparent',color:typeTab===t.id?C.black:C.midGray,
                fontWeight:typeTab===t.id?500:400,boxShadow:typeTab===t.id?'0 1px 3px rgba(0,0,0,.08)':'none'
              }}>{t.label}</button>
            ))}
          </div>
          <Card>
            <CardHeader title={`${typeTab==='pto'?'PTO':'Bereavement'} Ledger — All Employees`} right="Last 150 entries"/>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr>{['Date','Employee','Type','Hours','Balance After','Notes'].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>
                  {allLedger.filter(e=>e.leave_type===typeTab).length===0&&(
                    <tr><TD colSpan={6} style={{textAlign:'center',color:C.lightGray,padding:32}}>No entries yet</TD></tr>
                  )}
                  {allLedger.filter(e=>e.leave_type===typeTab).map(e=>(
                    <tr key={e.id}>
                      <TD style={{fontSize:12}}>{new Date(e.entry_date+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</TD>
                      <TD style={{fontWeight:500,fontSize:12}}>{e.profiles?.first_name} {e.profiles?.last_name}</TD>
                      <TD><Badge variant={entryColor[e.entry_type]||'default'}>{entryLabel[e.entry_type]||e.entry_type}</Badge></TD>
                      <TD style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:500,color:parseFloat(e.hours)>=0?C.black:'#cc4444'}}>
                        {parseFloat(e.hours)>=0?'+':''}{parseFloat(e.hours).toFixed(2)}h
                      </TD>
                      <TD style={{fontFamily:'var(--mono)',fontSize:12}}>{parseFloat(e.balance_after).toFixed(2)}h</TD>
                      <TD style={{fontSize:12,color:C.midGray}}>{e.notes||'—'}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Modals ── */}

      {/* Set Opening Balance */}
      <Modal open={openingModal} onClose={()=>setOpeningModal(false)} title="Set Opening Balance">
        <p style={{fontSize:13,color:C.midGray,marginBottom:18,lineHeight:1.6}}>
          Enter the current accrued hours to kick off tracking. This replaces any existing opening entry.
        </p>
        <Select label="Employee" value={openingForm.employeeId} onChange={e=>setOpeningForm(f=>({...f,employeeId:e.target.value}))}>
          {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </Select>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="PTO Hours" type="number" step="0.01" min="0"
            value={openingForm.ptoHours} onChange={e=>setOpeningForm(f=>({...f,ptoHours:e.target.value}))}
            placeholder="e.g. 48.00"/>
          <Input label="Bereavement Hours" type="number" step="0.01" min="0"
            value={openingForm.bereavementHours} onChange={e=>setOpeningForm(f=>({...f,bereavementHours:e.target.value}))}
            placeholder="e.g. 24.00"/>
        </div>
        <div style={{background:C.offWhite,border:`1px solid ${C.silver}`,borderRadius:5,padding:'10px 14px',fontSize:12,color:C.midGray,marginBottom:16}}>
          Leave a field blank to skip updating that balance type.
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="outline" onClick={()=>setOpeningModal(false)}>Cancel</Btn>
          <Btn onClick={handleSetOpening}>Save Opening Balance</Btn>
        </div>
      </Modal>

      {/* Run PTO Accrual */}
      <Modal open={accrualModal} onClose={()=>setAccrualModal(false)} title="Run Pay Period Accrual" width={400}>
        <p style={{fontSize:13,color:C.midGray,marginBottom:16,lineHeight:1.6}}>
          Adds <strong>6.46 PTO hours</strong> to every active employee's balance for the current pay period.
        </p>
        <div style={{background:C.offWhite,border:`1px solid ${C.silver}`,borderRadius:5,padding:'12px 14px',fontSize:12,color:C.midGray,marginBottom:18}}>
          Run this once per pay period on payday. Set a reminder every two weeks.
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="outline" onClick={()=>setAccrualModal(false)}>Cancel</Btn>
          <Btn onClick={runAccrual}>Run Accrual for All Employees</Btn>
        </div>
      </Modal>

      {/* Manual Adjustment */}
      <Modal open={adjustModal} onClose={()=>setAdjustModal(false)} title="Manual Adjustment">
        <p style={{fontSize:13,color:C.midGray,marginBottom:16,lineHeight:1.6}}>
          Add or deduct hours. Use a negative number to deduct.
        </p>
        <Select label="Employee" value={adjustForm.employeeId} onChange={e=>setAdjustForm(f=>({...f,employeeId:e.target.value}))}>
          <option value="">Select employee…</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </Select>
        <Select label="Leave Type" value={adjustForm.leaveType} onChange={e=>setAdjustForm(f=>({...f,leaveType:e.target.value}))}>
          <option value="pto">PTO</option>
          <option value="bereavement">Bereavement</option>
        </Select>
        <Input label="Hours (negative to deduct)" type="number" step="0.01"
          value={adjustForm.hours} onChange={e=>setAdjustForm(f=>({...f,hours:e.target.value}))} placeholder="e.g. 8 or -4"/>
        <div style={{marginBottom:16}}>
          <FormLabel>Reason</FormLabel>
          <textarea value={adjustForm.notes} onChange={e=>setAdjustForm(f=>({...f,notes:e.target.value}))} rows={2}
            placeholder="e.g. Correction, bonus hours…"
            style={{border:`1px solid ${C.silver}`,borderRadius:5,padding:'9px 12px',fontFamily:'var(--font)',fontSize:13,resize:'vertical',width:'100%',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="outline" onClick={()=>setAdjustModal(false)}>Cancel</Btn>
          <Btn onClick={handleAdjust}>Save Adjustment</Btn>
        </div>
      </Modal>
    </div>
  )
}


// ─── Timesheet Edit Request Page ─────────────────────────────
function TimesheetEditPage({ profile, toast }) {
  const isManager = ['admin','manager'].includes(profile.role)
  const sb = getClient()
  const [tab, setTab] = useState(isManager ? 'pending' : 'my')
  const [myEntries, setMyEntries] = useState([])
  const [pendingEdits, setPendingEdits] = useState([])
  const [allEdits, setAllEdits] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestModal, setRequestModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [editForm, setEditForm] = useState({ clockIn: '', clockOut: '', breakMins: '', reason: '' })
  const [denyModal, setDenyModal] = useState(false)
  const [denyTarget, setDenyTarget] = useState(null)
  const [denyReason, setDenyReason] = useState('')

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    try {
      if (tab === 'my') {
        // Employee's own recent entries
        const { data } = await sb.from('time_entries')
          .select('*')
          .eq('employee_id', profile.id)
          .not('clock_out', 'is', null)
          .order('clock_in', { ascending: false })
          .limit(30)
        setMyEntries(data || [])

        // Their own edit requests
        const { data: edits } = await sb.from('timesheet_edit_requests')
          .select('*, time_entries(clock_in, clock_out, break_mins)')
          .eq('employee_id', profile.id)
          .order('created_at', { ascending: false })
        setAllEdits(edits || [])
      } else {
        // Manager views pending or all requests
        const q = sb.from('timesheet_edit_requests')
          .select('*, profiles!timesheet_edit_requests_employee_id_fkey(first_name, last_name, department), time_entries(clock_in, clock_out, break_mins)')
          .order('created_at', { ascending: false })
        if (tab === 'pending') {
          const { data } = await q.eq('status', 'pending')
          setPendingEdits(data || [])
        } else {
          const { data } = await q
          setAllEdits(data || [])
        }
      }
    } catch(e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  function openEditRequest(entry) {
    setSelectedEntry(entry)
    // Pre-fill with current values
    const ci = new Date(entry.clock_in)
    const co = entry.clock_out ? new Date(entry.clock_out) : null
    setEditForm({
      clockIn: formatForInput(ci),
      clockOut: co ? formatForInput(co) : '',
      breakMins: entry.break_mins || 0,
      reason: ''
    })
    setRequestModal(true)
  }

  function formatForInput(d) {
    // Format as datetime-local value: YYYY-MM-DDTHH:MM
    const pad = n => String(n).padStart(2,'0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  async function submitEditRequest() {
    if (!editForm.clockIn) { toast('Clock-in time is required', 'error'); return }
    if (!editForm.reason.trim()) { toast('Please explain why this edit is needed', 'error'); return }
    try {
      const { error } = await sb.from('timesheet_edit_requests').insert({
        employee_id: profile.id,
        time_entry_id: selectedEntry.id,
        original_clock_in: selectedEntry.clock_in,
        original_clock_out: selectedEntry.clock_out,
        original_break_mins: selectedEntry.break_mins,
        requested_clock_in: new Date(editForm.clockIn).toISOString(),
        requested_clock_out: editForm.clockOut ? new Date(editForm.clockOut).toISOString() : null,
        requested_break_mins: parseInt(editForm.breakMins) || 0,
        reason: editForm.reason.trim(),
        status: 'pending'
      })
      if (error) throw error
      toast('Edit request submitted for approval')
      setRequestModal(false)
      setSelectedEntry(null)
      load()
    } catch(e) { toast(e.message, 'error') }
  }

  async function approveEdit(req) {
    try {
      // Apply the requested changes to the actual time entry
      const { error: entryErr } = await sb.from('time_entries').update({
        clock_in: req.requested_clock_in,
        clock_out: req.requested_clock_out,
        break_mins: req.requested_break_mins,
        status: 'approved'
      }).eq('id', req.time_entry_id)
      if (entryErr) throw entryErr

      // Mark request approved
      const { error: reqErr } = await sb.from('timesheet_edit_requests').update({
        status: 'approved',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString()
      }).eq('id', req.id)
      if (reqErr) throw reqErr

      toast('Edit approved and applied')
      load()
    } catch(e) { toast(e.message, 'error') }
  }

  async function denyEdit() {
    if (!denyReason.trim()) { toast('Please provide a reason for denial', 'error'); return }
    try {
      await sb.from('timesheet_edit_requests').update({
        status: 'denied',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        denial_reason: denyReason.trim()
      }).eq('id', denyTarget.id)
      toast('Request denied')
      setDenyModal(false)
      setDenyTarget(null)
      setDenyReason('')
      load()
    } catch(e) { toast(e.message, 'error') }
  }

  function fmtDT(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true })
  }

  function calcH(ci, co, brk=0) {
    if (!ci || !co) return '—'
    const h = ((new Date(co) - new Date(ci)) / 3600000) - brk/60
    return `${Math.max(0,h).toFixed(2)}h`
  }

  const tabs = [
    ...(isManager ? [{ id:'pending', label:'Pending Requests' }, { id:'all-mgr', label:'All Requests' }] : []),
    { id:'my', label: isManager ? 'My Timesheets' : 'Request an Edit' }
  ]

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Timesheet Edits</div>
          <div style={{ fontSize:13, color:C.midGray, marginTop:3 }}>
            {isManager ? 'Review and approve employee timesheet corrections' : 'Request a correction to a timesheet entry'}
          </div>
        </div>
        {isManager && tab==='pending' && pendingEdits.length > 0 && (
          <div style={{ background:'#cc4444', color:'#fff', borderRadius:99, fontSize:12, fontWeight:600, padding:'4px 12px', fontFamily:'var(--mono)' }}>
            {pendingEdits.length} pending
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:C.offWhite, borderRadius:7, padding:4, marginBottom:20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'7px 14px', border:'none', cursor:'pointer',
            fontFamily:'var(--font)', fontSize:13, borderRadius:6, transition:'all .14s',
            background: tab===t.id ? C.white : 'transparent',
            color: tab===t.id ? C.black : C.midGray,
            fontWeight: tab===t.id ? 500 : 400,
            boxShadow: tab===t.id ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
          }}>{t.label}</button>
        ))}
      </div>

      {/* MY TIMESHEETS — employee picks an entry to edit */}
      {tab === 'my' && (
        <>
          {/* My pending/past requests */}
          {allEdits.length > 0 && (
            <Card style={{ marginBottom:16 }}>
              <CardHeader title="My Edit Requests"/>
              {allEdits.map(r => (
                <div key={r.id} style={{ borderBottom:`1px solid ${C.offWhite}`, padding:'12px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <Badge variant={r.status==='approved'?'approved':r.status==='denied'?'flagged':'pending'}>
                      {r.status}
                    </Badge>
                    <span style={{ fontSize:12, color:C.midGray }}>
                      Requested {fmtDT(r.created_at)}
                    </span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12, marginBottom:6 }}>
                    <div style={{ background:C.offWhite, borderRadius:5, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:C.lightGray, marginBottom:4 }}>Original</div>
                      <div style={{ fontFamily:'var(--mono)' }}>In: {formatTime(r.original_clock_in)}</div>
                      <div style={{ fontFamily:'var(--mono)' }}>Out: {formatTime(r.original_clock_out)}</div>
                      <div style={{ color:C.midGray }}>Break: {r.original_break_mins||0}m</div>
                    </div>
                    <div style={{ background: r.status==='approved' ? '#f0fdf4' : C.offWhite, border: r.status==='approved'?'1px solid #bbf7d0':'none', borderRadius:5, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:C.lightGray, marginBottom:4 }}>Requested</div>
                      <div style={{ fontFamily:'var(--mono)' }}>In: {formatTime(r.requested_clock_in)}</div>
                      <div style={{ fontFamily:'var(--mono)' }}>Out: {formatTime(r.requested_clock_out)}</div>
                      <div style={{ color:C.midGray }}>Break: {r.requested_break_mins||0}m</div>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:C.midGray }}>
                    <strong style={{ color:C.black }}>Reason:</strong> {r.reason}
                  </div>
                  {r.denial_reason && (
                    <div style={{ fontSize:12, color:'#cc4444', marginTop:4 }}>
                      <strong>Denied:</strong> {r.denial_reason}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}

          {/* Recent entries table */}
          <Card>
            <CardHeader title="Recent Timesheet Entries" right="Click an entry to request an edit"/>
            {loading ? <div style={{color:C.lightGray}}>Loading…</div> : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr>{['Date','Clock In','Clock Out','Break','Hours','Status',''].map(h=><TH key={h}>{h}</TH>)}</tr>
                  </thead>
                  <tbody>
                    {myEntries.length===0 && <tr><TD colSpan={7} style={{textAlign:'center',color:C.lightGray,padding:32}}>No entries found</TD></tr>}
                    {myEntries.map(e => (
                      <tr key={e.id}>
                        <TD style={{fontSize:12}}>{formatDate(e.clock_in)}</TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12}}>{formatTime(e.clock_in)}</TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12}}>{formatTime(e.clock_out)}</TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12,color:C.midGray}}>{e.break_mins ? `${e.break_mins}m` : '—'}</TD>
                        <TD style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:500}}>{calcH(e.clock_in,e.clock_out,e.break_mins)}</TD>
                        <TD><Badge variant={e.status==='approved'?'approved':e.status==='flagged'?'flagged':e.status==='active'?'active':'pending'}>{e.status}</Badge></TD>
                        <TD>
                          <Btn size="sm" variant="outline" onClick={() => openEditRequest(e)}>
                            Request Edit
                          </Btn>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* MANAGER — Pending requests */}
      {tab === 'pending' && isManager && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {loading ? <div style={{color:C.lightGray}}>Loading…</div> :
           pendingEdits.length === 0 ? (
            <Card>
              <div style={{ textAlign:'center', padding:'40px 0', color:C.lightGray, fontSize:13 }}>
                No pending edit requests — all caught up!
              </div>
            </Card>
           ) : pendingEdits.map(r => (
            <Card key={r.id}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Avatar first={r.profiles?.first_name} last={r.profiles?.last_name} size={32}/>
                  <div>
                    <div style={{ fontWeight:600 }}>{r.profiles?.first_name} {r.profiles?.last_name}</div>
                    <div style={{ fontSize:12, color:C.midGray }}>{r.profiles?.department} · Requested {fmtDT(r.created_at)}</div>
                  </div>
                </div>
                <Badge variant="pending">Pending</Badge>
              </div>

              {/* Reason — prominently displayed */}
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:6, padding:'10px 14px', marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:'#92400e', marginBottom:4 }}>Employee Note</div>
                <div style={{ fontSize:13, color:C.black }}>{r.reason}</div>
              </div>

              {/* Before / After comparison */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ background:C.offWhite, borderRadius:6, padding:'12px 14px' }}>
                  <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:C.lightGray, marginBottom:8 }}>Original Entry</div>
                  <div style={{ fontSize:13, marginBottom:4 }}><span style={{color:C.midGray}}>Date:</span> {formatDate(r.original_clock_in)}</div>
                  <div style={{ fontSize:13, marginBottom:4 }}><span style={{color:C.midGray}}>In:</span> <span style={{fontFamily:'var(--mono)'}}>{formatTime(r.original_clock_in)}</span></div>
                  <div style={{ fontSize:13, marginBottom:4 }}><span style={{color:C.midGray}}>Out:</span> <span style={{fontFamily:'var(--mono)'}}>{formatTime(r.original_clock_out)}</span></div>
                  <div style={{ fontSize:13, color:C.midGray }}>Break: {r.original_break_mins||0}m</div>
                  <div style={{ fontSize:13, fontWeight:600, marginTop:8, color:C.midGray }}>Total: {calcH(r.original_clock_in,r.original_clock_out,r.original_break_mins)}</div>
                </div>
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'12px 14px' }}>
                  <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:'#166534', marginBottom:8 }}>Requested Change</div>
                  <div style={{ fontSize:13, marginBottom:4 }}><span style={{color:C.midGray}}>Date:</span> {formatDate(r.requested_clock_in)}</div>
                  <div style={{ fontSize:13, marginBottom:4 }}><span style={{color:C.midGray}}>In:</span> <span style={{fontFamily:'var(--mono)',color: r.requested_clock_in !== r.original_clock_in ? '#166534' : C.black, fontWeight: r.requested_clock_in !== r.original_clock_in ? 600 : 400}}>{formatTime(r.requested_clock_in)}</span></div>
                  <div style={{ fontSize:13, marginBottom:4 }}><span style={{color:C.midGray}}>Out:</span> <span style={{fontFamily:'var(--mono)',color: r.requested_clock_out !== r.original_clock_out ? '#166534' : C.black, fontWeight: r.requested_clock_out !== r.original_clock_out ? 600 : 400}}>{formatTime(r.requested_clock_out)}</span></div>
                  <div style={{ fontSize:13, color: r.requested_break_mins !== r.original_break_mins ? '#166534' : C.midGray, fontWeight: r.requested_break_mins !== r.original_break_mins ? 600 : 400 }}>Break: {r.requested_break_mins||0}m</div>
                  <div style={{ fontSize:13, fontWeight:600, marginTop:8, color:'#166534' }}>Total: {calcH(r.requested_clock_in,r.requested_clock_out,r.requested_break_mins)}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <Btn variant="danger" onClick={() => { setDenyTarget(r); setDenyModal(true) }}>Deny</Btn>
                <Btn onClick={() => approveEdit(r)}>Approve &amp; Apply</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MANAGER — All requests history */}
      {tab === 'all-mgr' && isManager && (
        <Card>
          <CardHeader title="All Edit Requests"/>
          {loading ? <div style={{color:C.lightGray}}>Loading…</div> : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>{['Employee','Date','Original In/Out','Requested In/Out','Reason','Status',''].map(h=><TH key={h}>{h}</TH>)}</tr>
                </thead>
                <tbody>
                  {allEdits.length===0 && <tr><TD colSpan={7} style={{textAlign:'center',color:C.lightGray,padding:32}}>No edit requests yet</TD></tr>}
                  {allEdits.map(r => (
                    <tr key={r.id}>
                      <TD style={{fontWeight:500,fontSize:12}}>{r.profiles?.first_name} {r.profiles?.last_name}</TD>
                      <TD style={{fontSize:12}}>{formatDate(r.original_clock_in)}</TD>
                      <TD style={{fontFamily:'var(--mono)',fontSize:11,color:C.midGray}}>
                        {formatTime(r.original_clock_in)} – {formatTime(r.original_clock_out)}
                      </TD>
                      <TD style={{fontFamily:'var(--mono)',fontSize:11}}>
                        {formatTime(r.requested_clock_in)} – {formatTime(r.requested_clock_out)}
                      </TD>
                      <TD style={{fontSize:12,color:C.midGray,maxWidth:200}}>
                        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.reason}</div>
                      </TD>
                      <TD>
                        <Badge variant={r.status==='approved'?'approved':r.status==='denied'?'flagged':'pending'}>
                          {r.status}
                        </Badge>
                      </TD>
                      <TD>
                        {r.status==='pending' && (
                          <div style={{display:'flex',gap:5}}>
                            <Btn size="sm" onClick={()=>approveEdit(r)}>✓</Btn>
                            <Btn size="sm" variant="danger" onClick={()=>{setDenyTarget(r);setDenyModal(true)}}>✕</Btn>
                          </div>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Request Edit Modal */}
      <Modal open={requestModal} onClose={()=>setRequestModal(false)} title="Request Timesheet Edit">
        {selectedEntry && (
          <>
            <div style={{ background:C.offWhite, borderRadius:6, padding:'10px 14px', marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:C.lightGray, marginBottom:6 }}>Current Entry</div>
              <div style={{ display:'flex', gap:20, fontSize:13 }}>
                <span><span style={{color:C.midGray}}>Date:</span> {formatDate(selectedEntry.clock_in)}</span>
                <span><span style={{color:C.midGray}}>In:</span> <span style={{fontFamily:'var(--mono)'}}>{formatTime(selectedEntry.clock_in)}</span></span>
                <span><span style={{color:C.midGray}}>Out:</span> <span style={{fontFamily:'var(--mono)'}}>{formatTime(selectedEntry.clock_out)}</span></span>
                <span style={{color:C.midGray}}>Break: {selectedEntry.break_mins||0}m</span>
              </div>
            </div>

            <div style={{ fontSize:13, fontWeight:600, marginBottom:14, color:C.black }}>Enter corrected values:</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Corrected Clock In" type="datetime-local"
                value={editForm.clockIn} onChange={e=>setEditForm(f=>({...f,clockIn:e.target.value}))}/>
              <Input label="Corrected Clock Out" type="datetime-local"
                value={editForm.clockOut} onChange={e=>setEditForm(f=>({...f,clockOut:e.target.value}))}/>
            </div>
            <Input label="Break (minutes)" type="number" min="0" max="120"
              value={editForm.breakMins} onChange={e=>setEditForm(f=>({...f,breakMins:e.target.value}))} placeholder="0"/>

            <div style={{ marginBottom:16 }}>
              <FormLabel>Reason for Edit <span style={{color:'#cc4444'}}>*</span></FormLabel>
              <textarea value={editForm.reason} onChange={e=>setEditForm(f=>({...f,reason:e.target.value}))}
                rows={3} placeholder="Explain why this correction is needed (e.g. forgot to clock out, system glitch, working offsite without access)…"
                style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box' }}/>
              <div style={{ fontSize:11, color:C.lightGray, marginTop:4 }}>Required — this note will be shown to your manager with the request.</div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <Btn variant="outline" onClick={()=>setRequestModal(false)}>Cancel</Btn>
              <Btn onClick={submitEditRequest}>Submit for Approval</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Deny Modal */}
      <Modal open={denyModal} onClose={()=>{setDenyModal(false);setDenyTarget(null);setDenyReason('')}} title="Deny Edit Request" width={400}>
        <p style={{ fontSize:13, color:C.midGray, marginBottom:16, lineHeight:1.6 }}>
          Provide a reason so the employee understands why the edit was not approved.
        </p>
        <div style={{ marginBottom:16 }}>
          <FormLabel>Reason for Denial <span style={{color:'#cc4444'}}>*</span></FormLabel>
          <textarea value={denyReason} onChange={e=>setDenyReason(e.target.value)} rows={3}
            placeholder="e.g. Hours do not match schedule, please resubmit with correct times…"
            style={{ border:`1px solid ${C.silver}`, borderRadius:5, padding:'9px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={()=>{setDenyModal(false);setDenyTarget(null);setDenyReason('')}}>Cancel</Btn>
          <Btn variant="danger" onClick={denyEdit}>Deny Request</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── Root App ──────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState('clock')
  const [toasts, setToasts]     = useState([])

  const toast = useCallback((msg, type='success') => {
    const id = Date.now()
    setToasts(t=>[...t,{id,msg,type}])
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), 3500)
  }, [])

  useEffect(()=>{
    const sb = getClient()
    let profileCache = null  // cache so re-fires don't overwrite role

    async function loadProfile(user) {
      // Return cached profile if we already have it for this user
      if (profileCache && profileCache.id === user.id) return profileCache

      try {
        const { data, error } = await sb
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) console.error('Profile error:', error)
        const d = data || {}
        const p = {
          id: user.id,
          email: user.email || '',
          first_name: d.first_name || user.email?.split('@')[0] || 'User',
          last_name: d.last_name || '',
          role: d.role || 'employee',
          department: d.department || '',
          employment_type: d.employment_type || 'fulltime',
          pto_balance: d.pto_balance ?? 15,
          pto_used: d.pto_used ?? 0,
          is_active: d.is_active ?? true,
          hourly_rate: d.hourly_rate || 0,
        }
        profileCache = p  // cache it
        return p
      } catch(e) {
        console.error('Profile fetch failed:', e)
        // If we have a cached profile, use it rather than resetting role
        if (profileCache && profileCache.id === user.id) return profileCache
        return {
          id: user.id, email: user.email || '',
          first_name: user.email?.split('@')[0] || 'User',
          last_name: '', role: 'employee',
          department: '', employment_type: 'fulltime',
          pto_balance: 15, pto_used: 0, is_active: true, hourly_rate: 0,
        }
      }
    }

    const safetyTimer = setTimeout(() => setLoading(false), 6000)

    sb.auth.getSession().then(async({data:{session}})=>{
      clearTimeout(safetyTimer)
      setSession(session)
      if (session?.user) {
        const p = await loadProfile(session.user)
        setProfile(p)
        setPage(prev => {
          // Only set page on first load (prev is the default 'clock')
          if (prev === 'clock' && ['admin','manager'].includes(p.role)) return 'dashboard'
          return prev
        })
      }
      setLoading(false)
    }).catch(e => {
      console.error('getSession failed:', e)
      clearTimeout(safetyTimer)
      setLoading(false)
    })

    const {data:{subscription}} = sb.auth.onAuthStateChange(async(event, session)=>{
      // Ignore TOKEN_REFRESHED — this fires every hour and causes the role reset
      if (event === 'TOKEN_REFRESHED') return

      setSession(session)
      if (session?.user) {
        const p = await loadProfile(session.user)
        setProfile(p)
        // Only navigate on actual sign-in, not on every state change
        if (event === 'SIGNED_IN') {
          setPage(['admin','manager'].includes(p.role) ? 'dashboard' : 'clock')
        }
      } else if (event === 'SIGNED_OUT') {
        profileCache = null
        setProfile(null)
        setPage('clock')
      }
      setLoading(false)
    })

    return ()=>{ subscription.unsubscribe(); clearTimeout(safetyTimer) }
  },[])

  async function handleSignOut() { await signOut(); setSession(null); setProfile(null) }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.offWhite }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:`2px solid ${C.silver}`, borderTopColor:C.black, borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
        <div style={{ fontSize:12, color:C.lightGray, letterSpacing:.5, textTransform:'uppercase' }}>Loading…</div>
      </div>
    </div>
  )

  if (!session||!profile) return <><LoginPage onLogin={(u,p)=>{setSession({user:u});setProfile(p)}} toast={toast}/><Toast toasts={toasts}/></>

  const isManager = ['admin','manager'].includes(profile.role)
  const navItems = [
    ...(isManager?[{id:'dashboard',label:'Dashboard',icon:'⊞'}]:[]),
    {id:'clock',label:'Time Clock',icon:'◷'},
    ...(isManager?[{id:'timesheets',label:'Timesheets',icon:'☰'}]:[]),
    {id:'editrequests',label:'Timesheet Edits',icon:'✎'},
    {id:'timeoff',label:'Time Off',icon:'◈'},
    {id:'pto',label:'PTO',icon:'◐'},
    {id:'holidays',label:'Holidays',icon:'◻'},
    {id:'payperiods',label:'Pay Periods',icon:'◑'},
    ...(isManager?[{id:'employees',label:'Employees',icon:'◎'}]:[]),
    {id:'profile',label:'My Profile',icon:'⊙'},
  ]

  return (
    <>
      <Head>
        <title>PunchDesk</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
        <link rel="icon" href="/logo.png"/>
      </Head>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
        body{font-family:var(--font);background:${C.offWhite};color:${C.black};line-height:1.55}
        button:focus,input:focus,select:focus,textarea:focus{outline:2px solid ${C.midGray};outline-offset:1px}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:${C.silver};border-radius:3px}
        ::-webkit-scrollbar-track{background:transparent}
        tr:hover td{background:${C.offWhite}}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:.5;cursor:pointer}
        select option{font-family:var(--font)}
      `}</style>

      <div style={{ display:'grid', gridTemplateColumns:'210px 1fr', minHeight:'100vh' }}>

        {/* ── Sidebar ── */}
        <nav style={{ background:C.charcoal, display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto', borderRight:`1px solid ${C.darkGray}` }}>

          {/* Logo */}
          <div style={{ padding:'22px 20px 20px', borderBottom:`1px solid ${C.darkGray}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:34, height:34, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src="/logo.png" alt="Logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', filter:'brightness(0) invert(1)' }}
                  onError={e=>{ e.target.style.display='none' }}/>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:C.white, letterSpacing:-.3 }}>PunchDesk</div>
                <div style={{ fontSize:9, color:C.midGray, fontFamily:'var(--mono)', letterSpacing:1, textTransform:'uppercase' }}>workforce</div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div style={{ padding:'12px 0', flex:1 }}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>setPage(item.id)} style={{
                display:'flex', alignItems:'center', gap:10, width:'100%',
                padding:'10px 20px', border:'none', cursor:'pointer',
                fontFamily:'var(--font)', fontSize:13, letterSpacing:.2,
                background: page===item.id ? 'rgba(255,255,255,.08)' : 'transparent',
                color: page===item.id ? C.white : C.midGray,
                fontWeight: page===item.id ? 500 : 400,
                borderLeft: page===item.id ? `2px solid ${C.white}` : '2px solid transparent',
                transition:'all .12s',
              }}>
                <span style={{ fontSize:13, opacity:.8 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* User footer */}
          <div style={{ padding:'14px 16px', borderTop:`1px solid ${C.darkGray}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px', borderRadius:6, cursor:'pointer', transition:'background .12s' }}
              onClick={()=>setPage('profile')}>
              <Avatar first={profile.first_name} last={profile.last_name} size={30}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.first_name} {profile.last_name}</div>
                <div style={{ fontSize:10, color:C.midGray, textTransform:'uppercase', letterSpacing:.5 }}>{profile.role}</div>
              </div>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#6fcf97', flexShrink:0 }}/>
            </div>
            <button onClick={handleSignOut} style={{
              width:'100%', marginTop:8, padding:'7px', border:`1px solid ${C.darkGray}`,
              borderRadius:5, background:'transparent', fontFamily:'var(--font)',
              fontSize:11, color:C.midGray, cursor:'pointer', letterSpacing:.5,
              textTransform:'uppercase', transition:'all .12s',
            }}>
              Sign Out
            </button>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main style={{ padding:'30px 32px', overflowY:'auto', background:C.offWhite }}>
          {page==='dashboard' && isManager && <AdminDashboard profile={profile} toast={toast}/>}
          {page==='clock'      && <ClockPage profile={profile} toast={toast}/>}
          {page==='timesheets' && isManager && <TimesheetsPage profile={profile} toast={toast}/>}
          {page==='timeoff'    && <MyTimeOffPage profile={profile} toast={toast}/>}
          {page==='holidays'   && <HolidaysPage profile={profile} toast={toast}/>}
          {page==='employees'  && isManager && <EmployeesPage profile={profile} toast={toast}/>}
          {page==='profile'    && <ProfilePage profile={profile} toast={toast} onUpdate={setProfile}/>}
          {page==='payperiods'  && <PayPeriodsPage profile={profile} toast={toast}/>}
          {page==='pto'         && <PTOPage profile={profile} toast={toast}/>}
          {page==='editrequests' && <TimesheetEditPage profile={profile} toast={toast}/>}
        </main>
      </div>

      <Toast toasts={toasts}/>
    </>
  )
}
