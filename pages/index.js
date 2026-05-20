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
      const { user } = await signIn(email, pw)
      const profile = await getProfile(user.id)
      onLogin(user, profile)
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
              <div style={{ background:'#fff0f0', color:'#cc4444', border:'1px solid #ffcccc', borderRadius:5, padding:'9px 12px', fontSize:12, marginBottom:14 }}>{err}</div>
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
              <tr>{['Date','Location','Clock In','Clock Out','Break','Hours','Status'].map(h=><TH key={h}>{h}</TH>)}</tr>
            </thead>
            <tbody>
              {entries.length===0 && <tr><TD colSpan={7} style={{ textAlign:'center', color:C.lightGray, padding:32 }}>No recent entries</TD></tr>}
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

    async function loadProfile(user) {
      try {
        const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single()
        if (error) console.error('Profile error:', error)
        const d = data || {}
        return {
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
      } catch(e) {
        console.error('Profile fetch failed:', e)
        return {
          id: user.id, email: user.email || '',
          first_name: user.email?.split('@')[0] || 'User',
          last_name: '', role: 'employee',
          department: '', employment_type: 'fulltime',
          pto_balance: 15, pto_used: 0, is_active: true, hourly_rate: 0,
        }
      }
    }

    sb.auth.getSession().then(async({data:{session}})=>{
      setSession(session)
      if (session?.user) {
        const p = await loadProfile(session.user)
        setProfile(p)
        setPage(['admin','manager'].includes(p.role)?'dashboard':'clock')
      }
      setLoading(false)
    })

    const {data:{subscription}} = sb.auth.onAuthStateChange(async(event,session)=>{
      setSession(session)
      if (session?.user) {
        const p = await loadProfile(session.user)
        setProfile(p)
        setPage(['admin','manager'].includes(p.role)?'dashboard':'clock')
        setLoading(false)
      } else {
        setProfile(null); setPage('clock'); setLoading(false)
      }
    })
    return ()=>subscription.unsubscribe()
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
    {id:'timeoff',label:'Time Off',icon:'◈'},
    {id:'holidays',label:'Holidays',icon:'◻'},
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
        </main>
      </div>

      <Toast toasts={toasts}/>
    </>
  )
}
