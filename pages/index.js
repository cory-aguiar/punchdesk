import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import {
  getClient
} from '../lib/supabase'
import {
  signIn, signOut, getProfile,
  clockIn, clockOut, getActiveEntry, getEntriesForEmployee,
  getAllEmployees, getAllEntries, approveEntry, flagEntry, getClockedInNow,
  submitTimeOff, getTimeOffForEmployee, getAllTimeOff, reviewTimeOff,
  getHolidays, addHoliday, deleteHoliday,
  calcHours, formatHours, formatTime, formatDate, getInitials
} from '../lib/db'

// ─── Helpers ──────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
function fmtClock(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function fmtDateLong(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
function weekStart(d = new Date()) {
  const dd = new Date(d); dd.setDate(dd.getDate() - dd.getDay() + 1); dd.setHours(0,0,0,0); return dd
}

// ─── Components ───────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div style={{ position:'fixed', bottom:24, right:24, display:'flex', flexDirection:'column', gap:8, zIndex:9999, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#7f1d1d' : '#1a2e1f',
          color:'#fff', padding:'11px 18px', borderRadius:8,
          fontSize:13, display:'flex', alignItems:'center', gap:8,
          boxShadow:'0 4px 12px rgba(0,0,0,.2)',
          animation:'slideUp .22s ease'
        }}>
          <span>{t.type === 'error' ? '⚠' : '✓'}</span>{t.msg}
        </div>
      ))}
    </div>
  )
}

function Badge({ children, color = 'gray' }) {
  const colors = {
    green:  { bg:'#dcfce7', text:'#16a34a' },
    amber:  { bg:'#fef3c7', text:'#92400e' },
    red:    { bg:'#fee2e2', text:'#991b1b' },
    blue:   { bg:'#dbeafe', text:'#1e40af' },
    purple: { bg:'#ede9fe', text:'#5b21b6' },
    gray:   { bg:'#f3f4f6', text:'#6b7280' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:500, background:c.bg, color:c.text }}>
      {children}
    </span>
  )
}

function Avatar({ first, last, size = 34 }) {
  const colors = ['#1a6b4a','#1a4a7a','#5b21b6','#92400e','#166534']
  const idx = ((first?.charCodeAt(0) || 0) + (last?.charCodeAt(0) || 0)) % colors.length
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background: colors[idx] + '22',
      color: colors[idx],
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.35, fontWeight:600, flexShrink:0,
      fontFamily:'var(--mono)'
    }}>
      {getInitials(first, last)}
    </div>
  )
}

function Modal({ open, onClose, title, children, width = 460 }) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:800, backdropFilter:'blur(3px)' }}/>
      <div style={{
        position:'fixed', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        background:'#fff', borderRadius:14, padding:'24px 28px',
        width, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto',
        zIndex:900, boxShadow:'0 20px 60px rgba(0,0,0,.22)'
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:600 }}>{title}</div>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:22, color:'#a09d98', padding:'2px 6px', borderRadius:4 }}>×</button>
        </div>
        {children}
      </div>
    </>
  )
}

function Input({ label, ...props }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
      {label && <label style={{ fontSize:12, fontWeight:500, color:'#6b6860' }}>{label}</label>}
      <input {...props} style={{
        border:'1px solid #e4e1d9', borderRadius:7, padding:'8px 12px',
        fontFamily:'var(--font)', fontSize:13, background:'#fff', color:'#1c1a17', outline:'none',
        width:'100%', boxSizing:'border-box',
        ...(props.style || {})
      }}/>
    </div>
  )
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
      {label && <label style={{ fontSize:12, fontWeight:500, color:'#6b6860' }}>{label}</label>}
      <select {...props} style={{
        border:'1px solid #e4e1d9', borderRadius:7, padding:'8px 12px',
        fontFamily:'var(--font)', fontSize:13, background:'#fff', color:'#1c1a17',
        width:'100%', cursor:'pointer', outline:'none'
      }}>
        {children}
      </select>
    </div>
  )
}

function Btn({ children, variant = 'primary', size = 'md', style: s, ...props }) {
  const styles = {
    primary: { background:'#1a6b4a', color:'#fff', border:'none' },
    outline:  { background:'#fff', color:'#1c1a17', border:'1px solid #d4d1c8' },
    danger:   { background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca' },
    purple:   { background:'#ede9fe', color:'#5b21b6', border:'1px solid #c4b5fd' },
    ghost:    { background:'transparent', color:'#6b6860', border:'none' },
  }
  const sizes = {
    sm: { padding:'5px 11px', fontSize:12 },
    md: { padding:'8px 16px', fontSize:13 },
    lg: { padding:'12px 24px', fontSize:15 },
  }
  return (
    <button {...props} style={{
      display:'inline-flex', alignItems:'center', gap:6,
      borderRadius:7, fontFamily:'var(--font)', fontWeight:500,
      cursor:'pointer', transition:'all .14s', whiteSpace:'nowrap',
      ...styles[variant], ...sizes[size], ...s
    }}>
      {children}
    </button>
  )
}

function Card({ children, style: s }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e4e1d9', borderRadius:14, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,.05)', ...s }}>
      {children}
    </div>
  )
}

function StatCard({ label, value, delta, deltaColor = '#6b6860' }) {
  return (
    <Card>
      <div style={{ fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:.5, color:'#a09d98', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:600, fontFamily:'var(--mono)', letterSpacing:-1.5 }}>{value}</div>
      {delta && <div style={{ fontSize:12, color:deltaColor, marginTop:2 }}>{delta}</div>}
    </Card>
  )
}

// ─── Login Page ───────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { user } = await signIn(email, password)
      const profile = await getProfile(user.id)
      onLogin(user, profile)
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f2f0eb', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{
            width:56, height:56, borderRadius:16, background:'#1a6b4a',
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px'
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="9" stroke="#fff" strokeWidth="1.5" fill="none" opacity=".5"/>
              <path d="M14 8v6.5l4 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize:26, fontWeight:600, letterSpacing:-.5 }}>PunchDesk</div>
          <div style={{ fontSize:13, color:'#6b6860', marginTop:4 }}>Sign in to your account</div>
        </div>

        <Card>
          <form onSubmit={handleLogin}>
            <Input label="Work Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus/>
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required/>
            {error && <div style={{ background:'#fee2e2', color:'#991b1b', borderRadius:7, padding:'10px 12px', fontSize:13, marginBottom:14 }}>{error}</div>}
            <Btn type="submit" style={{ width:'100%', justifyContent:'center', padding:'11px 0' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Btn>
          </form>
          <div style={{ textAlign:'center', marginTop:14 }}>
            <button onClick={() => setShowReset(true)} style={{ background:'none', border:'none', color:'#1a6b4a', fontSize:13, cursor:'pointer', fontFamily:'var(--font)' }}>
              Forgot password?
            </button>
          </div>
        </Card>

        <div style={{ textAlign:'center', marginTop:24, fontSize:12, color:'#a09d98' }}>
          New employee? Your manager will send you an invitation.
        </div>

        <Modal open={showReset} onClose={() => setShowReset(false)} title="Reset Password" width={380}>
          <p style={{ fontSize:13, color:'#6b6860', marginBottom:16 }}>Enter your work email and we'll send a reset link.</p>
          <Input label="Email" type="email" placeholder="you@company.com"/>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn variant="outline" onClick={() => setShowReset(false)}>Cancel</Btn>
            <Btn onClick={() => setShowReset(false)}>Send Reset Link</Btn>
          </div>
        </Modal>
      </div>
    </div>
  )
}

// ─── Clock Page (employee default) ────────────────────────────
function ClockPage({ profile, toast }) {
  const [now, setNow] = useState(new Date())
  const [activeEntry, setActiveEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [location, setLocation] = useState('remote')
  const [breakModal, setBreakModal] = useState(false)
  const [breakMins, setBreakMins] = useState(0)
  const [noteModal, setNoteModal] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    load()
  }, [profile.id])

  async function load() {
    try {
      const [entry, recent] = await Promise.all([
        getActiveEntry(profile.id),
        getEntriesForEmployee(profile.id, { from: new Date(Date.now() - 7 * 86400000).toISOString() })
      ])
      setActiveEntry(entry)
      setEntries(recent || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleClockIn() {
    try {
      const entry = await clockIn(profile.id, location)
      setActiveEntry(entry)
      toast('Clocked in successfully')
    } catch (err) { toast(err.message, 'error') }
  }

  async function handleClockOut() {
    setBreakModal(true)
  }

  async function confirmClockOut() {
    try {
      await clockOut(activeEntry.id, parseInt(breakMins) || 0, note)
      setActiveEntry(null)
      setBreakModal(false)
      setBreakMins(0); setNote('')
      toast('Clocked out — great work!')
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const elapsed = activeEntry
    ? calcHours(activeEntry.clock_in, now.toISOString())
    : null

  const statusColor = activeEntry ? '#4ade80' : '#f87171'

  return (
    <div>
      {/* Clock hero */}
      <div style={{
        background:'linear-gradient(135deg, #1a2e1f 0%, #0f3d28 100%)',
        borderRadius:16, padding:'32px 36px', color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20, position:'relative', overflow:'hidden'
      }}>
        <div style={{ position:'absolute', right:-70, top:-70, width:200, height:200, borderRadius:'50%', border:'40px solid rgba(255,255,255,.04)' }}/>
        <div>
          <div style={{ fontSize:56, fontWeight:600, fontFamily:'var(--mono)', letterSpacing:-3, lineHeight:1 }}>
            {fmtClock(now)}
          </div>
          <div style={{ fontSize:13, opacity:.65, marginTop:6 }}>{fmtDateLong(now)}</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginTop:14, background:'rgba(255,255,255,.1)', padding:'6px 14px', borderRadius:99, fontSize:13, backdropFilter:'blur(2px)' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:statusColor, boxShadow: activeEntry ? '0 0 6px #4ade8088' : 'none' }}/>
            {activeEntry ? `Clocked in · ${formatHours(elapsed)}` : 'Not clocked in'}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10, zIndex:1 }}>
          {!activeEntry ? (
            <>
              <Select style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', borderRadius:7, padding:'8px 12px', marginBottom:0 }}
                value={location} onChange={e => setLocation(e.target.value)}>
                <option value="remote">📡 Remote</option>
                <option value="office">🏢 Office</option>
                <option value="field">🚗 Field / Onsite</option>
              </Select>
              <button onClick={handleClockIn} style={{ background:'#fff', color:'#1a2e1f', border:'none', padding:'13px 28px', borderRadius:8, fontFamily:'var(--font)', fontSize:15, fontWeight:600, cursor:'pointer' }}>
                Clock In
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize:12, opacity:.7, textAlign:'center' }}>📍 {activeEntry.location}</div>
              <button onClick={handleClockOut} style={{ background:'#f87171', color:'#fff', border:'none', padding:'13px 28px', borderRadius:8, fontFamily:'var(--font)', fontSize:15, fontWeight:600, cursor:'pointer' }}>
                Clock Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recent entries */}
      <Card>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Recent Entries</div>
        {loading ? <div style={{ color:'#a09d98', fontSize:13 }}>Loading…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f2f0eb' }}>
                {['Date','Location','In','Out','Break','Hours','Status'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'9px 12px', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:.4, color:'#6b6860', borderBottom:'1px solid #e4e1d9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={7} style={{ padding:20, textAlign:'center', color:'#a09d98' }}>No recent entries</td></tr>
              )}
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom:'1px solid #f2f0eb' }}>
                  <td style={{ padding:'10px 12px' }}>{formatDate(e.clock_in)}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#6b6860' }}>{e.location || '—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_in)}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{e.clock_out ? formatTime(e.clock_out) : <Badge color="blue">Active</Badge>}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{e.break_mins ? `${e.break_mins}m` : '—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>
                    {e.clock_out ? formatHours(calcHours(e.clock_in, e.clock_out, e.break_mins)) : <span style={{ color:'#1a6b4a' }}>In progress</span>}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <Badge color={e.status === 'approved' ? 'green' : e.status === 'flagged' ? 'red' : e.status === 'active' ? 'blue' : 'amber'}>
                      {e.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Clock-out modal */}
      <Modal open={breakModal} onClose={() => setBreakModal(false)} title="Clock Out" width={380}>
        <p style={{ fontSize:13, color:'#6b6860', marginBottom:16 }}>Log any break time before clocking out.</p>
        <Input label="Break Time (minutes)" type="number" min="0" max="120" value={breakMins} onChange={e => setBreakMins(e.target.value)} placeholder="0"/>
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:500, color:'#6b6860' }}>Notes (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Anything to flag for your manager…" style={{ border:'1px solid #e4e1d9', borderRadius:7, padding:'8px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={() => setBreakModal(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmClockOut}>Confirm Clock Out</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── My Time Off Page ──────────────────────────────────────────
function MyTimeOffPage({ profile, toast }) {
  const [requests, setRequests] = useState([])
  const [holidays, setHolidays] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ leaveType:'vacation', startDate:'', endDate:'', notes:'' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile.id])

  async function load() {
    try {
      const [reqs, hols] = await Promise.all([
        getTimeOffForEmployee(profile.id),
        getHolidays()
      ])
      setRequests(reqs || [])
      setHolidays(hols || [])
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleSubmit() {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    const start = new Date(form.startDate + 'T12:00:00')
    const end   = new Date(form.endDate + 'T12:00:00')
    const days  = Math.round((end - start) / 86400000) + 1
    // Check holiday overlap
    const holDates = holidays.map(h => h.date)
    let daysReq = 0
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      const ds = d.toISOString().split('T')[0]
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6 && !holDates.includes(ds)) daysReq++
    }
    try {
      await submitTimeOff({ employeeId: profile.id, leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate, daysRequested: daysReq, notes: form.notes })
      toast('Request submitted for approval')
      setModal(false)
      setForm({ leaveType:'vacation', startDate:'', endDate:'', notes:'' })
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>My Time Off</div>
          <div style={{ fontSize:13, color:'#6b6860', marginTop:2 }}>PTO balance: <strong>{profile.pto_balance - profile.pto_used} days</strong> remaining</div>
        </div>
        <Btn onClick={() => setModal(true)}>+ New Request</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="PTO Balance" value={profile.pto_balance - profile.pto_used} delta={`of ${profile.pto_balance} annual days`}/>
        <StatCard label="Sick Days Used" value={profile.pto_used || 0} delta="this year"/>
        <StatCard label="Pending Requests" value={requests.filter(r => r.status === 'pending').length} delta="awaiting approval" deltaColor="#92400e"/>
      </div>

      <Card>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>My Requests</div>
        {loading ? <div style={{ color:'#a09d98' }}>Loading…</div> : requests.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'#a09d98', fontSize:13 }}>No time off requests yet</div>
        ) : (
          requests.map(r => (
            <div key={r.id} style={{ border:'1px solid #e4e1d9', borderRadius:10, padding:'13px 15px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <div style={{ fontWeight:500, textTransform:'capitalize' }}>{r.leave_type}</div>
                <Badge color={r.status === 'approved' ? 'green' : r.status === 'denied' ? 'red' : 'amber'}>
                  {r.status}
                </Badge>
              </div>
              <div style={{ fontSize:13, color:'#6b6860' }}>
                {new Date(r.start_date + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                {r.start_date !== r.end_date && ` – ${new Date(r.end_date + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}`}
                {' '}· {r.days_requested} day{r.days_requested !== 1 ? 's' : ''}
              </div>
              {r.notes && <div style={{ fontSize:12, color:'#a09d98', marginTop:4 }}>{r.notes}</div>}
              {r.denial_reason && <div style={{ fontSize:12, color:'#991b1b', marginTop:4 }}>Reason: {r.denial_reason}</div>}
            </div>
          ))
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="New Time Off Request">
        <Select label="Leave Type" value={form.leaveType} onChange={e => setForm(f => ({...f, leaveType: e.target.value}))}>
          <option value="vacation">Vacation</option>
          <option value="sick">Sick Leave</option>
          <option value="personal">Personal</option>
          <option value="bereavement">Bereavement</option>
        </Select>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Start Date" type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))}/>
          <Input label="End Date" type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate: e.target.value}))}/>
        </div>
        <div style={{ background:'#ede9fe', borderRadius:7, padding:'9px 12px', fontSize:12, color:'#5b21b6', marginBottom:14 }}>
          🎉 Holidays within your selected dates will not be deducted from your PTO balance.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:500, color:'#6b6860' }}>Notes (optional)</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any context for your manager…" style={{ border:'1px solid #e4e1d9', borderRadius:7, padding:'8px 12px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', width:'100%', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
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

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [ci, to, ts] = await Promise.all([
        getClockedInNow(),
        getAllTimeOff({ status: 'pending' }),
        getAllEntries({ status: 'pending' })
      ])
      setClockedIn(ci || [])
      setPendingTO(to || [])
      setPendingTS(ts || [])
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleApproveTO(id) {
    try {
      await reviewTimeOff(id, { status:'approved', reviewerId: profile.id })
      toast('Request approved')
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  async function handleDenyTO(id) {
    try {
      await reviewTimeOff(id, { status:'denied', reviewerId: profile.id })
      toast('Request denied')
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  async function handleApproveTS(id) {
    try {
      await approveEntry(id, profile.id)
      toast('Timesheet approved')
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div>
      <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4, marginBottom:4 }}>Manager Dashboard</div>
      <div style={{ fontSize:13, color:'#6b6860', marginBottom:20 }}>{fmtDateLong(new Date())}</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Clocked In Now" value={clockedIn.length} delta="employees working" deltaColor="#1a6b4a"/>
        <StatCard label="Pending Timesheets" value={pendingTS.length} delta="need approval" deltaColor="#92400e"/>
        <StatCard label="Time Off Requests" value={pendingTO.length} delta="need review" deltaColor="#92400e"/>
        <StatCard label="Remote Today" value={clockedIn.filter(e => e.location === 'remote').length} delta="of clocked-in"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Currently clocked in */}
        <Card>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Currently Clocked In</div>
          {loading ? <div style={{ color:'#a09d98', fontSize:13 }}>Loading…</div> :
           clockedIn.length === 0 ? <div style={{ fontSize:13, color:'#a09d98' }}>Nobody clocked in</div> :
           clockedIn.map(e => (
            <div key={e.entry_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #f2f0eb' }}>
              <Avatar first={e.full_name?.split(' ')[0]} last={e.full_name?.split(' ')[1]} size={30}/>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{e.full_name}</div>
                <div style={{ fontSize:11, color:'#a09d98' }}>{e.department} · {e.location}</div>
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'#1a6b4a' }}>{formatHours(e.hours_so_far)}</div>
            </div>
          ))}
        </Card>

        {/* Pending time off */}
        <Card>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Pending Time Off</div>
          {loading ? <div style={{ color:'#a09d98', fontSize:13 }}>Loading…</div> :
           pendingTO.length === 0 ? <div style={{ fontSize:13, color:'#a09d98' }}>No pending requests</div> :
           pendingTO.map(r => (
            <div key={r.id} style={{ border:'1px solid #e4e1d9', borderRadius:8, padding:'11px 13px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
                <span style={{ fontWeight:500, fontSize:13 }}>{r.profiles?.first_name} {r.profiles?.last_name}</span>
                <Badge color="amber">Pending</Badge>
              </div>
              <div style={{ fontSize:12, color:'#6b6860', marginBottom:8, textTransform:'capitalize' }}>
                {r.leave_type} · {new Date(r.start_date + 'T12:00').toLocaleDateString('en-US', {month:'short',day:'numeric'})}
                {r.start_date !== r.end_date && ` – ${new Date(r.end_date + 'T12:00').toLocaleDateString('en-US', {month:'short',day:'numeric'})}`}
                {' '}({r.days_requested}d)
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <Btn size="sm" onClick={() => handleApproveTO(r.id)}>Approve</Btn>
                <Btn size="sm" variant="danger" onClick={() => handleDenyTO(r.id)}>Deny</Btn>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Pending timesheets */}
      <Card>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Pending Timesheets</div>
        {loading ? <div style={{ color:'#a09d98', fontSize:13 }}>Loading…</div> :
         pendingTS.length === 0 ? <div style={{ fontSize:13, color:'#a09d98', padding:'20px 0', textAlign:'center' }}>All caught up — no pending timesheets!</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f2f0eb' }}>
                {['Employee','Dept','Date','Location','In','Out','Hours','Action'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'9px 12px', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:.4, color:'#6b6860', borderBottom:'1px solid #e4e1d9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingTS.map(e => (
                <tr key={e.id} style={{ borderBottom:'1px solid #f2f0eb' }}>
                  <td style={{ padding:'10px 12px', fontWeight:500 }}>{e.profiles?.first_name} {e.profiles?.last_name}</td>
                  <td style={{ padding:'10px 12px', color:'#6b6860', fontSize:12 }}>{e.profiles?.department}</td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{formatDate(e.clock_in)}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#6b6860' }}>{e.location || '—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_in)}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_out)}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>
                    {formatHours(calcHours(e.clock_in, e.clock_out, e.break_mins))}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <Btn size="sm" onClick={() => handleApproveTS(e.id)}>Approve</Btn>
                      <Btn size="sm" variant="danger" onClick={async () => { await flagEntry(e.id); toast('Entry flagged'); load() }}>Flag</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ─── Admin: All Timesheets ────────────────────────────────────
function TimesheetsPage({ profile, toast }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [weekOf, setWeekOf] = useState(weekStart().toISOString().split('T')[0])

  useEffect(() => { load() }, [filter, weekOf])

  async function load() {
    setLoading(true)
    try {
      const from = new Date(weekOf + 'T00:00:00').toISOString()
      const to   = new Date(new Date(weekOf).getTime() + 7 * 86400000).toISOString()
      const data = await getAllEntries({ from, to, status: filter === 'all' ? undefined : filter })
      setEntries(data || [])
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Timesheets</div>
          <div style={{ fontSize:13, color:'#6b6860', marginTop:2 }}>Review and approve employee time</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Input label="" type="date" value={weekOf} onChange={e => setWeekOf(e.target.value)} style={{ marginBottom:0 }}/>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ border:'1px solid #e4e1d9', borderRadius:7, padding:'8px 12px', fontFamily:'var(--font)', fontSize:13 }}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      <Card>
        {loading ? <div style={{ color:'#a09d98', fontSize:13 }}>Loading…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f2f0eb' }}>
                {['Employee','Dept','Date','Location','In','Out','Break','Hours','Status','Action'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'9px 12px', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:.4, color:'#6b6860', borderBottom:'1px solid #e4e1d9', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={10} style={{ padding:24, textAlign:'center', color:'#a09d98' }}>No entries found</td></tr>}
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom:'1px solid #f2f0eb' }}>
                  <td style={{ padding:'10px 12px', fontWeight:500 }}>{e.profiles?.first_name} {e.profiles?.last_name}</td>
                  <td style={{ padding:'10px 12px', color:'#6b6860', fontSize:12 }}>{e.profiles?.department}</td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{formatDate(e.clock_in)}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#6b6860' }}>{e.location || '—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_in)}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{formatTime(e.clock_out)}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12 }}>{e.break_mins ? `${e.break_mins}m` : '—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>{formatHours(calcHours(e.clock_in, e.clock_out, e.break_mins))}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <Badge color={e.status === 'approved' ? 'green' : e.status === 'flagged' ? 'red' : e.status === 'active' ? 'blue' : 'amber'}>{e.status}</Badge>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    {e.status === 'pending' && (
                      <div style={{ display:'flex', gap:5 }}>
                        <Btn size="sm" onClick={async () => { await approveEntry(e.id, profile.id); toast('Approved'); load() }}>✓</Btn>
                        <Btn size="sm" variant="danger" onClick={async () => { await flagEntry(e.id); toast('Flagged'); load() }}>⚑</Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ─── Holidays Page ────────────────────────────────────────────
function HolidaysPage({ profile, toast }) {
  const [holidays, setHolidays] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name:'', date:'', type:'federal', applies_to:'all', paid_hours:8 })
  const [loading, setLoading] = useState(true)
  const isManager = ['admin','manager'].includes(profile.role)

  useEffect(() => { load() }, [])

  async function load() {
    try { setHolidays(await getHolidays()) }
    catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!form.name || !form.date) { toast('Name and date required', 'error'); return }
    try {
      await addHoliday({ ...form, paid_hours: parseInt(form.paid_hours) })
      toast(`${form.name} added`)
      setModal(false)
      setForm({ name:'', date:'', type:'federal', applies_to:'all', paid_hours:8 })
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove "${name}"?`)) return
    try { await deleteHoliday(id); toast('Holiday removed'); load() }
    catch (err) { toast(err.message, 'error') }
  }

  const typeColor = { federal:'blue', company:'green', state:'amber' }
  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Holiday Calendar</div>
          <div style={{ fontSize:13, color:'#6b6860', marginTop:2 }}>Auto-applied to all timesheets as paid hours</div>
        </div>
        {isManager && <Btn variant="purple" onClick={() => setModal(true)}>+ Add Holiday</Btn>}
      </div>

      <Card>
        {loading ? <div style={{ color:'#a09d98' }}>Loading…</div> : (
          holidays.map(h => {
            const isPast = h.date < today
            const isUpcoming = !isPast && h.date <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom:'1px solid #f2f0eb', opacity: isPast ? .65 : 1 }}>
                <div style={{
                  width:44, height:44, borderRadius:10, flexShrink:0,
                  background: isUpcoming ? '#5b21b6' : isPast ? '#f3f4f6' : '#ede9fe',
                  color: isUpcoming ? '#fff' : isPast ? '#9ca3af' : '#5b21b6',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  fontSize:9, fontFamily:'var(--mono)', fontWeight:600, lineHeight:1.3
                }}>
                  {new Date(h.date + 'T12:00').toLocaleDateString('en-US',{month:'short'})}<br/>
                  {new Date(h.date + 'T12:00').getDate()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{h.name}</div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3 }}>
                    <Badge color={typeColor[h.type] || 'gray'}>{h.type}</Badge>
                    <span style={{ fontSize:11, color:'#a09d98' }}>{h.paid_hours}h paid · {h.applies_to === 'all' ? 'All employees' : h.applies_to}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {isUpcoming && <Badge color="purple">Upcoming</Badge>}
                  {isPast && <Badge color="gray">Past</Badge>}
                  {isManager && (
                    <button onClick={() => handleDelete(h.id, h.name)} style={{ border:'none', background:'none', cursor:'pointer', color:'#a09d98', fontSize:18, padding:'2px 6px', borderRadius:4 }}>×</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Holiday">
        <Input label="Holiday Name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Independence Day"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}/>
          <Select label="Type" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
            <option value="federal">Federal</option>
            <option value="company">Company</option>
            <option value="state">State/Regional</option>
          </Select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Select label="Applies To" value={form.applies_to} onChange={e => setForm(f => ({...f, applies_to: e.target.value}))}>
            <option value="all">All Employees</option>
            <option value="fulltime">Full-time Only</option>
          </Select>
          <Select label="Paid Hours" value={form.paid_hours} onChange={e => setForm(f => ({...f, paid_hours: e.target.value}))}>
            <option value="8">8h (full day)</option>
            <option value="4">4h (half day)</option>
            <option value="0">0h (unpaid)</option>
          </Select>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
          <Btn variant="purple" onClick={handleAdd}>Add Holiday</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── Employees Page (admin only) ──────────────────────────────
function EmployeesPage({ profile, toast }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email:'', firstName:'', lastName:'', role:'employee', department:'', type:'fulltime' })

  useEffect(() => { load() }, [])
  async function load() {
    try { setEmployees(await getAllEmployees()) }
    catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  const filtered = employees.filter(e =>
    !search || `${e.first_name} ${e.last_name} ${e.department}`.toLowerCase().includes(search.toLowerCase())
  )

  async function handleInvite() {
    if (!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName) { toast('All fields required', 'error'); return }
    try {
      // In a real app you'd send an invite email via Supabase Auth admin API
      // For now we create the user directly
      const supabase = getClient()
      const { data, error } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: Math.random().toString(36).slice(2, 14), // temp password
        options: { data: { first_name: inviteForm.firstName, last_name: inviteForm.lastName, role: inviteForm.role } }
      })
      if (error) throw error
      toast(`Invite sent to ${inviteForm.email}`)
      setInviteModal(false)
      setInviteForm({ email:'', firstName:'', lastName:'', role:'employee', department:'', type:'fulltime' })
      setTimeout(load, 1000)
    } catch (err) { toast(err.message, 'error') }
  }

  const roleColor = { admin:'red', manager:'purple', employee:'green' }
  const typeLabel = { fulltime:'Full-time', parttime:'Part-time', contractor:'Contractor' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4 }}>Employees</div>
          <div style={{ fontSize:13, color:'#6b6860', marginTop:2 }}>{employees.length} active employees</div>
        </div>
        <Btn onClick={() => setInviteModal(true)}>+ Invite Employee</Btn>
      </div>

      <Card>
        <div style={{ marginBottom:16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or department…" style={{ border:'1px solid #e4e1d9', borderRadius:7, padding:'8px 12px 8px 32px', fontFamily:'var(--font)', fontSize:13, width:280, backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23a09d98' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'10px center' }}/>
        </div>
        {loading ? <div style={{ color:'#a09d98' }}>Loading…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f2f0eb' }}>
                {['Employee','Department','Type','Role','Status','Holiday Pay'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'9px 12px', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:.4, color:'#6b6860', borderBottom:'1px solid #e4e1d9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderBottom:'1px solid #f2f0eb' }}>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <Avatar first={e.first_name} last={e.last_name} size={30}/>
                      <div>
                        <div style={{ fontWeight:500 }}>{e.first_name} {e.last_name}</div>
                        <div style={{ fontSize:11, color:'#a09d98' }}>{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'10px 12px', color:'#6b6860' }}>{e.department || '—'}</td>
                  <td style={{ padding:'10px 12px' }}>{typeLabel[e.employment_type] || e.employment_type}</td>
                  <td style={{ padding:'10px 12px' }}><Badge color={roleColor[e.role] || 'gray'}>{e.role}</Badge></td>
                  <td style={{ padding:'10px 12px' }}><Badge color={e.is_active ? 'green' : 'gray'}>{e.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td style={{ padding:'10px 12px' }}><Badge color="purple">{e.employment_type === 'fulltime' ? '8h/holiday' : 'Pro-rata'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Invite Employee">
        <div style={{ background:'#e5f5ed', borderRadius:7, padding:'10px 12px', fontSize:12, color:'#1a6b4a', marginBottom:16 }}>
          An invitation email will be sent. The employee will create their own password.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="First Name" value={inviteForm.firstName} onChange={e => setInviteForm(f => ({...f, firstName: e.target.value}))} placeholder="Jane"/>
          <Input label="Last Name" value={inviteForm.lastName} onChange={e => setInviteForm(f => ({...f, lastName: e.target.value}))} placeholder="Smith"/>
        </div>
        <Input label="Work Email" type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({...f, email: e.target.value}))} placeholder="jane@company.com"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Department" value={inviteForm.department} onChange={e => setInviteForm(f => ({...f, department: e.target.value}))} placeholder="Engineering"/>
          <Select label="Role" value={inviteForm.role} onChange={e => setInviteForm(f => ({...f, role: e.target.value}))}>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Select label="Employment Type" value={inviteForm.type} onChange={e => setInviteForm(f => ({...f, type: e.target.value}))}>
          <option value="fulltime">Full-time</option>
          <option value="parttime">Part-time</option>
          <option value="contractor">Contractor</option>
        </Select>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="outline" onClick={() => setInviteModal(false)}>Cancel</Btn>
          <Btn onClick={handleInvite}>Send Invitation</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────
function ProfilePage({ profile, toast, onUpdate }) {
  const [form, setForm] = useState({ first_name: profile.first_name, last_name: profile.last_name, department: profile.department || '' })
  const [pwForm, setPwForm] = useState({ current:'', newPw:'', confirm:'' })

  async function handleSave() {
    try {
      const { updateProfile } = await import('../lib/db')
      await updateProfile(profile.id, form)
      toast('Profile updated')
      onUpdate({ ...profile, ...form })
    } catch (err) { toast(err.message, 'error') }
  }

  async function handlePwChange() {
    if (pwForm.newPw !== pwForm.confirm) { toast('Passwords do not match', 'error'); return }
    if (pwForm.newPw.length < 8) { toast('Password must be at least 8 characters', 'error'); return }
    try {
      const { error } = await getClient().auth.updateUser({ password: pwForm.newPw })
      if (error) throw error
      toast('Password updated')
      setPwForm({ current:'', newPw:'', confirm:'' })
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div style={{ maxWidth:520 }}>
      <div style={{ fontSize:22, fontWeight:600, letterSpacing:-.4, marginBottom:20 }}>My Profile</div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, paddingBottom:20, borderBottom:'1px solid #f2f0eb' }}>
          <Avatar first={profile.first_name} last={profile.last_name} size={56}/>
          <div>
            <div style={{ fontWeight:600, fontSize:16 }}>{profile.first_name} {profile.last_name}</div>
            <div style={{ fontSize:13, color:'#6b6860' }}>{profile.email}</div>
            <Badge color={{ admin:'red', manager:'purple', employee:'green' }[profile.role] || 'gray'}>{profile.role}</Badge>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="First Name" value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))}/>
          <Input label="Last Name" value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))}/>
        </div>
        <Input label="Department" value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}/>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn onClick={handleSave}>Save Changes</Btn>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Change Password</div>
        <Input label="New Password" type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({...f, newPw: e.target.value}))} placeholder="At least 8 characters"/>
        <Input label="Confirm Password" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))} placeholder="Re-enter new password"/>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn onClick={handlePwChange}>Update Password</Btn>
        </div>
      </Card>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('clock')
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  useEffect(() => {
    const supabase = getClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        try {
          const p = await getProfile(session.user.id)
          setProfile(p)
          setPage(p.role === 'admin' || p.role === 'manager' ? 'dashboard' : 'clock')
        } catch (err) { console.error(err) }
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session?.user) {
        const p = await getProfile(session.user.id)
        setProfile(p)
        setPage(p.role === 'admin' || p.role === 'manager' ? 'dashboard' : 'clock')
      } else {
        setProfile(null)
        setPage('clock')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null); setProfile(null)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f2f0eb' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #e4e1d9', borderTopColor:'#1a6b4a', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
        <div style={{ fontSize:13, color:'#6b6860' }}>Loading PunchDesk…</div>
      </div>
    </div>
  )

  if (!session || !profile) return (
    <>
      <LoginPage onLogin={(u, p) => { setSession({ user: u }); setProfile(p) }}/>
      <Toast toasts={toasts}/>
    </>
  )

  const isManager = ['admin','manager'].includes(profile.role)

  // Nav items
  const navItems = [
    ...(isManager ? [{ id:'dashboard', label:'Dashboard', icon:'⊞' }] : []),
    { id:'clock', label:'Time Clock', icon:'◷' },
    ...(isManager ? [{ id:'timesheets', label:'Timesheets', icon:'☰' }] : []),
    { id:'timeoff', label:'Time Off', icon:'☀' },
    { id:'holidays', label:'Holidays', icon:'🗓' },
    ...(isManager ? [{ id:'employees', label:'Employees', icon:'◎' }] : []),
    { id:'profile', label:'My Profile', icon:'⊙' },
  ]

  return (
    <>
      <Head>
        <title>PunchDesk</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --font: 'DM Sans', sans-serif; --mono: 'DM Mono', monospace; }
        body { font-family: var(--font); background: #f2f0eb; color: #1c1a17; }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        button:hover { opacity: .9; }
        select:focus, input:focus { border-color: #1a6b4a !important; outline: none; box-shadow: 0 0 0 3px rgba(26,107,74,.1); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4d1c8; border-radius: 3px; }
      `}</style>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', minHeight:'100vh' }}>
        {/* Sidebar */}
        <nav style={{ background:'#fff', borderRight:'1px solid #e4e1d9', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
          {/* Logo */}
          <div style={{ padding:'20px 18px 18px', borderBottom:'1px solid #e4e1d9' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'#1a6b4a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="9" stroke="#fff" strokeWidth="1.5" fill="none" opacity=".5"/><path d="M14 8v6.5l4 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:600, letterSpacing:-.3 }}>PunchDesk</div>
                <div style={{ fontSize:10, color:'#a09d98', fontFamily:'var(--mono)', letterSpacing:.5 }}>workforce · v2</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ padding:'10px 0', flex:1 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                display:'flex', alignItems:'center', gap:10, width:'100%',
                padding:'9px 18px', border:'none', cursor:'pointer', fontFamily:'var(--font)', fontSize:13,
                background: page === item.id ? '#e5f5ed' : 'transparent',
                color: page === item.id ? '#1a6b4a' : '#6b6860',
                fontWeight: page === item.id ? 500 : 400,
                transition:'all .12s',
              }}>
                <span style={{ fontSize:14 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* User footer */}
          <div style={{ padding:'14px 16px', borderTop:'1px solid #e4e1d9' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:8, cursor:'pointer' }} onClick={() => setPage('profile')}>
              <Avatar first={profile.first_name} last={profile.last_name} size={32}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.first_name} {profile.last_name}</div>
                <div style={{ fontSize:11, color:'#a09d98', textTransform:'capitalize' }}>{profile.role}</div>
              </div>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>
            </div>
            <button onClick={handleSignOut} style={{ width:'100%', marginTop:6, padding:'7px', border:'1px solid #e4e1d9', borderRadius:7, background:'none', fontFamily:'var(--font)', fontSize:12, color:'#6b6860', cursor:'pointer' }}>
              Sign Out
            </button>
          </div>
        </nav>

        {/* Main */}
        <main style={{ padding:'28px 30px', overflowY:'auto' }}>
          {page === 'dashboard' && isManager && <AdminDashboard profile={profile} toast={toast}/>}
          {page === 'clock'     && <ClockPage profile={profile} toast={toast}/>}
          {page === 'timesheets'&& isManager && <TimesheetsPage profile={profile} toast={toast}/>}
          {page === 'timeoff'   && <MyTimeOffPage profile={profile} toast={toast}/>}
          {page === 'holidays'  && <HolidaysPage profile={profile} toast={toast}/>}
          {page === 'employees' && isManager && <EmployeesPage profile={profile} toast={toast}/>}
          {page === 'profile'   && <ProfilePage profile={profile} toast={toast} onUpdate={setProfile}/>}
        </main>
      </div>

      <Toast toasts={toasts}/>
    </>
  )
}
