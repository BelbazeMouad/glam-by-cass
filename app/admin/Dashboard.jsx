'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO, isAfter, isBefore, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { EMAIL_DEFAULTS, fillTags, FOOTER_DEFAULT } from '@/lib/email';

const GOLD = '#e0a94a', CRIMSON = '#a5283d', PIE = ['#e0a94a','#a5283d','#c6912a','#7a6f58','#b07d2e','#8a2a3a'];
const TABS = [
  ['overview','Overview','◈'],
  ['bookings','Bookings','✦'],
  ['services','Services & Prices','✧'],
  ['daysoff','Days Off','☾'],
  ['reels','Reels','▶'],
  ['messages','Messages','✉'],
  ['emails','Emails','✎'],
  ['settings','Contact Info','⚙'],
];

export default function Dashboard({ supabase, onSignOut }) {
  const [tab, setTab] = useState('overview');
  const [theme, setTheme] = useState('dark');
  const [msgs, setMsgs] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [openConvo, setOpenConvo] = useState(null); // message object shown as convo
  const [minimized, setMinimized] = useState(false);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const loadMsgs = () => supabase.from('messages').select('*').order('created_at', { ascending: false }).then(({ data }) => setMsgs(data || []));
  useEffect(() => { loadMsgs(); const t = setInterval(loadMsgs, 20000); return () => clearInterval(t); }, []);

  const unread = msgs.filter(m => !m.read).length;

  async function openMessage(m) {
    setOpenConvo(m); setMinimized(false); setBellOpen(false);
    if (!m.read) { await supabase.from('messages').update({ read: true }).eq('id', m.id); loadMsgs(); }
  }
  async function del(id) {
    await supabase.from('messages').delete().eq('id', id);
    if (openConvo?.id === id) setOpenConvo(null);
    loadMsgs();
  }

  return (
    <div className="dash-shell">
      <div className="dash-bg" aria-hidden></div>
      <div className="dash-top">
        <div className="brand-name gold-text">GLAM <small>By Cass · Studio</small></div>
        <div className="dash-top-actions">
          <div className="bell-wrap">
            <button className="bell-btn" onClick={() => setBellOpen(!bellOpen)} aria-label="Messages">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
              {unread > 0 && <span className="bell-badge">{unread}</span>}
            </button>
            {bellOpen && (
              <div className="bell-drop">
                <div className="bell-head">Messages{unread > 0 && <span className="muted"> · {unread} new</span>}</div>
                <div className="bell-list">
                  {msgs.length ? msgs.slice(0, 8).map(m => (
                    <div key={m.id} className={'bell-item' + (m.read ? '' : ' unread')} onClick={() => openMessage(m)}>
                      <div className="bi-top"><strong>{m.from_name || 'Anonymous'}</strong>{!m.read && <span className="dotnew" />}</div>
                      <div className="bi-preview">{m.body}</div>
                    </div>
                  )) : <div className="muted" style={{ padding: '14px' }}>No messages yet.</div>}
                </div>
              </div>
            )}
          </div>
          <button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☾' : '☀'}</button>
          <button className="btn ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
      <div className="dash-main">
        <div className="dash-tabs">
          {TABS.map(([id, label, ico]) => (
            <button key={id} className={'dash-tab' + (id === tab ? ' on' : '')} onClick={() => setTab(id)}>
              <span className="ti">{ico}</span>{label}{id === 'messages' && unread > 0 && <span className="tab-badge">{unread}</span>}
            </button>
          ))}
        </div>
        <div className="panel-anim" key={tab}>
          {tab === 'overview' && <Overview supabase={supabase} />}
          {tab === 'bookings' && <Bookings supabase={supabase} />}
          {tab === 'services' && <Services supabase={supabase} />}
          {tab === 'daysoff'  && <DaysOff  supabase={supabase} />}
          {tab === 'reels'    && <Reels    supabase={supabase} />}
          {tab === 'messages' && <Messages supabase={supabase} msgs={msgs} onOpen={openMessage} onDelete={del} />}
          {tab === 'emails'   && <Emails   supabase={supabase} />}
          {tab === 'settings' && <Settings supabase={supabase} />}
        </div>
      </div>

      {openConvo && (
        <ConvoPanel msg={openConvo} minimized={minimized}
          onMinimize={() => setMinimized(!minimized)}
          onClose={() => setOpenConvo(null)}
          onDelete={() => del(openConvo.id)}
          onReplied={loadMsgs} />
      )}
    </div>
  );
}

/* ================= CONVO PANEL (pop-out chat, minimize/close/reply/delete) ================= */
function ConvoPanel({ msg, minimized, onMinimize, onClose, onDelete, onReplied }) {
  const [reply, setReply] = useState(msg.reply || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!msg.reply);

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    await fetch('/api/message-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: msg.id, reply }) });
    setSending(false); setSent(true); onReplied();
  }

  return (
    <div className={'convo' + (minimized ? ' min' : '')}>
      <div className="convo-head" onClick={minimized ? onMinimize : undefined}>
        <div className="convo-who">{msg.from_name || 'Anonymous'}<div className="convo-email">{msg.from_email}</div></div>
        <div className="convo-controls">
          <button onClick={onMinimize} title={minimized ? 'Expand' : 'Minimize'}>{minimized ? '▢' : '—'}</button>
          <button onClick={onDelete} title="Delete" className="del">🗑</button>
          <button onClick={onClose} title="Close">×</button>
        </div>
      </div>
      {!minimized && (
        <div className="convo-body">
          <div className="bubble in"><div className="bubble-txt">{msg.body}</div></div>
          {sent && reply && <div className="bubble out"><div className="bubble-txt">{reply}</div><div className="bubble-meta">Sent to client ✓</div></div>}
          <div className="convo-reply">
            <textarea placeholder="Write a reply… (emails the client)" value={reply} onChange={e => { setReply(e.target.value); setSent(false); }} rows={2} />
            <button className="btn" onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= OVERVIEW / ANALYTICS ================= */
function Overview({ supabase }) {
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('bookings').select('*'),
      supabase.from('services').select('*'),
      supabase.from('messages').select('*'),
    ]).then(([b, s, m]) => {
      setBookings(b.data || []); setServices(s.data || []); setMsgs(m.data || []); setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const paid = bookings.filter(b => b.paid);
    const confirmed = bookings.filter(b => b.status === 'confirmed');
    const pending = bookings.filter(b => b.status === 'pending');
    const today = startOfToday();
    const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.booking_date && isAfter(parseISO(b.booking_date), today));
    const revenue = paid.reduce((s, b) => s + Number(b.deposit_amount || 0), 0);
    return { total: bookings.length, revenue, confirmed: confirmed.length, pending: pending.length, upcoming, unread: msgs.filter(m => !m.handled).length };
  }, [bookings, msgs]);

  // bookings per month (last 6)
  const monthly = useMemo(() => {
    const map = {};
    for (let i = 5; i >= 0; i--) { const d = subMonths(new Date(), i); map[format(d, 'MMM')] = 0; }
    bookings.forEach(b => { if (b.booking_date) { const k = format(parseISO(b.booking_date), 'MMM'); if (k in map) map[k]++; } });
    return Object.entries(map).map(([month, count]) => ({ month, count }));
  }, [bookings]);

  // revenue per month
  const revMonthly = useMemo(() => {
    const map = {};
    for (let i = 5; i >= 0; i--) { const d = subMonths(new Date(), i); map[format(d, 'MMM')] = 0; }
    bookings.filter(b => b.paid).forEach(b => { if (b.booking_date) { const k = format(parseISO(b.booking_date), 'MMM'); if (k in map) map[k] += Number(b.deposit_amount || 0); } });
    return Object.entries(map).map(([month, revenue]) => ({ month, revenue }));
  }, [bookings]);

  // top services
  const byService = useMemo(() => {
    const map = {};
    bookings.forEach(b => { const k = b.service_name || 'Other'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [bookings]);

  function exportAll() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bookings.map(b => ({
      Client: b.client_name, Email: b.client_email, Phone: b.client_phone, Service: b.service_name,
      Date: b.booking_date, Time: b.booking_time, Deposit: b.deposit_amount, Paid: b.paid ? 'Yes' : 'No', Status: b.status,
    }))), 'Bookings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(services.map(s => ({
      Service: s.name, Price: s.price, Deposit: s.deposit, Minutes: s.duration_min, Active: s.active ? 'Yes' : 'No',
    }))), 'Services');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(msgs.map(m => ({
      From: m.from_name, Email: m.from_email, Message: m.body, Date: m.created_at,
    }))), 'Messages');
    XLSX.writeFile(wb, `glam-studio-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }

  if (loading) return <div className="skel-grid">{[...Array(4)].map((_, i) => <div key={i} className="skel" />)}</div>;

  const cards = [
    ['Total Bookings', stats.total, '✦'],
    ['Deposits Collected', '€' + stats.revenue.toFixed(0), '€'],
    ['Confirmed', stats.confirmed, '✓'],
    ['Awaiting Review', stats.pending, '◔'],
  ];

  return (
    <div>
      <div className="panel-head">
        <h3>Studio Overview</h3>
        <button className="btn" onClick={exportAll}>⬇ Download Excel (all data)</button>
      </div>

      <div className="stat-row">
        {cards.map(([label, num, ico], i) => (
          <div className="stat pop" style={{ animationDelay: i * 60 + 'ms' }} key={label}>
            <div className="stat-ico">{ico}</div>
            <div className="label">{label}</div>
            <div className="num gold-text">{num}</div>
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card pop">
          <h4>Bookings — last 6 months</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(224,169,74,.1)" />
              <XAxis dataKey="month" stroke="#a39d8c" fontSize={12} />
              <YAxis stroke="#a39d8c" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#140d0c', border: '1px solid rgba(224,169,74,.3)', borderRadius: 8, color: '#e9e2d2' }} />
              <Bar dataKey="count" fill={GOLD} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card pop">
          <h4>Deposit revenue — last 6 months</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(224,169,74,.1)" />
              <XAxis dataKey="month" stroke="#a39d8c" fontSize={12} />
              <YAxis stroke="#a39d8c" fontSize={12} />
              <Tooltip contentStyle={{ background: '#140d0c', border: '1px solid rgba(224,169,74,.3)', borderRadius: 8, color: '#e9e2d2' }} formatter={v => '€' + v} />
              <Line type="monotone" dataKey="revenue" stroke={CRIMSON} strokeWidth={2.5} dot={{ fill: GOLD, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card pop">
          <h4>Popular services</h4>
          {byService.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byService} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                  {byService.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#140d0c', border: '1px solid rgba(224,169,74,.3)', borderRadius: 8, color: '#e9e2d2' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="muted">No bookings yet.</p>}
          <div className="legend">{byService.slice(0, 6).map((s, i) => <span key={s.name}><i style={{ background: PIE[i % PIE.length] }} />{s.name}</span>)}</div>
        </div>

        <div className="chart-card pop">
          <h4>Upcoming appointments</h4>
          <div className="upcoming">
            {stats.upcoming.length ? stats.upcoming.slice(0, 6).map(b => (
              <div className="up-row" key={b.id}>
                <div><strong>{b.client_name}</strong><div className="muted">{b.service_name}</div></div>
                <div className="up-date">{b.booking_date}<div className="muted">{b.booking_time}</div></div>
              </div>
            )) : <p className="muted">Nothing scheduled yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= BOOKINGS (accept / decline + WhatsApp) ================= */
function Bookings({ supabase }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('all');
  const load = () => supabase.from('bookings').select('*').order('booking_date').then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  async function act(id, action) {
    setBusy(id);
    await fetch('/api/booking-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: id, action }) });
    setBusy(null); load();
  }

  function waLink(b) {
    const phone = (b.client_phone || '').replace(/[^\d]/g, '');
    const msg = encodeURIComponent(`Hi ${b.client_name}! This is Cass regarding your ${b.service_name} booking on ${b.booking_date}.`);
    return phone ? `https://wa.me/${phone}?text=${msg}` : null;
  }

  function exportXlsx() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(b => ({
      Client: b.client_name, Email: b.client_email, Phone: b.client_phone, Service: b.service_name,
      Date: b.booking_date, Time: b.booking_time, Deposit: b.deposit_amount, Paid: b.paid ? 'Yes' : 'No', Status: b.status,
    }))), 'Bookings');
    XLSX.writeFile(wb, 'glam-bookings.xlsx');
  }

  const shown = filter === 'all' ? rows : rows.filter(b => b.status === filter);

  return (
    <div>
      <div className="panel-head">
        <h3>Bookings</h3>
        <button className="btn ghost" onClick={exportXlsx}>⬇ Export Excel</button>
      </div>
      <div className="chips">
        {['all', 'pending', 'confirmed', 'cancelled'].map(f => (
          <button key={f} className={'chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Client</th><th>Service</th><th>Date</th><th>Deposit</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {shown.map(b => (
              <tr key={b.id}>
                <td>{b.client_name}<div className="muted" style={{ fontSize: '.75rem' }}>{b.client_email}</div></td>
                <td>{b.service_name}</td>
                <td>{b.booking_date}<div className="muted" style={{ fontSize: '.75rem' }}>{b.booking_time}</div></td>
                <td><span className={'tag ' + (b.paid ? 'paid' : 'pending')}>{b.paid ? `€${b.deposit_amount}` : 'Unpaid'}</span></td>
                <td><span className={'tag ' + b.status}>{b.status}</span></td>
                <td>
                  <div className="row-actions">
                    {b.status === 'pending' && <>
                      <button className="mini ok" disabled={busy === b.id} onClick={() => act(b.id, 'accept')}>Accept</button>
                      <button className="mini no" disabled={busy === b.id} onClick={() => act(b.id, 'decline')}>Decline</button>
                    </>}
                    {waLink(b) && <a className="mini wa" href={waLink(b)} target="_blank" rel="noreferrer">WhatsApp</a>}
                  </div>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="muted">No bookings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= SERVICES & PRICES ================= */
function Services({ supabase }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(null);
  const load = () => supabase.from('services').select('*').order('sort_order').then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  async function save(row) {
    setSaving(row.id);
    await supabase.from('services').update({ name: row.name, description: row.description, price: row.price, deposit: row.deposit, duration_min: row.duration_min, active: row.active }).eq('id', row.id);
    setSaving(null); load();
  }
  async function add() { await supabase.from('services').insert({ name: 'New Service', price: 0, deposit: 0, sort_order: rows.length + 1 }); load(); }
  async function del(id) { await supabase.from('services').delete().eq('id', id); load(); }
  const upd = (id, k, v) => setRows(rows.map(r => r.id === id ? { ...r, [k]: v } : r));

  return (
    <div>
      <div className="panel-head"><h3>Services &amp; Prices</h3><button className="btn" onClick={add}>+ Add Service</button></div>
      <p className="muted">Edit prices and deposits — changes apply instantly on the booking page.</p>
      <div className="svc-editor">
        {rows.map(r => (
          <div className="svc-edit-card pop" key={r.id}>
            <input className="fld" value={r.name} onChange={e => upd(r.id, 'name', e.target.value)} placeholder="Service name" />
            <textarea className="fld" rows={2} value={r.description || ''} onChange={e => upd(r.id, 'description', e.target.value)} placeholder="Description" />
            <div className="svc-edit-row">
              <label>Price €<input className="fld sm" type="number" value={r.price} onChange={e => upd(r.id, 'price', e.target.value)} /></label>
              <label>Deposit €<input className="fld sm" type="number" value={r.deposit} onChange={e => upd(r.id, 'deposit', e.target.value)} /></label>
              <label>Mins<input className="fld sm" type="number" value={r.duration_min} onChange={e => upd(r.id, 'duration_min', e.target.value)} /></label>
            </div>
            <div className="svc-edit-actions">
              <button className="btn" onClick={() => save(r)}>{saving === r.id ? 'Saving…' : 'Save'}</button>
              <button className="btn ghost" onClick={() => del(r.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= DAYS OFF ================= */
function DaysOff({ supabase }) {
  const [days, setDays] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(startOfMonth(new Date()));
  const [editingReason, setEditingReason] = useState(null);
  const [reasonDraft, setReasonDraft] = useState('');

  const load = () => supabase.from('days_off').select('*').order('off_date').then(({ data }) => setDays(data || []));
  useEffect(() => { load(); }, []);

  const blockedDates = new Set(days.map(d => d.off_date));
  const today = startOfToday();
  const monthDays = eachDayOfInterval({ start: startOfMonth(pickerMonth), end: endOfMonth(pickerMonth) });
  const blanks = getDay(startOfMonth(pickerMonth));

  async function toggleDay(d) {
    const key = format(d, 'yyyy-MM-dd');
    if (isBefore(d, today)) return;
    if (blockedDates.has(key)) {
      const existing = days.find(x => x.off_date === key);
      if (existing) await supabase.from('days_off').delete().eq('id', existing.id);
    } else {
      await supabase.from('days_off').insert({ off_date: key, reason: '' });
    }
    load();
  }

  async function saveReason(id) {
    await supabase.from('days_off').update({ reason: reasonDraft }).eq('id', id);
    setEditingReason(null); load();
  }

  async function del(id) { await supabase.from('days_off').delete().eq('id', id); load(); }

  return (
    <div>
      <div className="panel-head"><h3>Days Off</h3></div>
      <p className="muted">Block a day so clients can't book it. Booked + paid days block automatically.</p>

      <div className="dayoff-add pop">
        <button className="btn ghost" onClick={() => setShowPicker(!showPicker)}>
          {showPicker ? 'Close calendar' : 'Pick a day off'}
        </button>

        {showPicker && (
          <div className="doff-picker">
            <div className="doff-cal-head">
              <button onClick={() => setPickerMonth(addMonths(pickerMonth, -1))}>‹</button>
              <strong>{format(pickerMonth, 'MMMM yyyy')}</strong>
              <button onClick={() => setPickerMonth(addMonths(pickerMonth, 1))}>›</button>
            </div>
            <div className="doff-cal">
              {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="doff-dow">{d}</div>)}
              {Array.from({ length: blanks }).map((_,i) => <div key={'b'+i} />)}
              {monthDays.map(d => {
                const key = format(d, 'yyyy-MM-dd');
                const isPast = isBefore(d, today);
                const isOff = blockedDates.has(key);
                return (
                  <div key={key}
                    className={'doff-day' + (isPast ? ' past' : '') + (isOff ? ' blocked' : ' avail')}
                    onClick={() => !isPast && toggleDay(d)}>
                    {format(d, 'd')}
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{textAlign:'center',marginTop:8,fontSize:'.76rem'}}>Click a date to block or unblock it</p>
          </div>
        )}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {days.map(d => (
              <tr key={d.id}>
                <td>{d.off_date}</td>
                <td>
                  {editingReason === d.id ? (
                    <div style={{display:'flex',gap:6}}>
                      <input className="fld" style={{flex:1}} placeholder="Reason" autoFocus
                        value={reasonDraft}
                        onChange={e => setReasonDraft(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') saveReason(d.id); if(e.key==='Escape') setEditingReason(null); }} />
                      <button className="mini ok" onClick={() => saveReason(d.id)}>Save</button>
                    </div>
                  ) : (
                    <span className="reason-cell" onClick={() => { setEditingReason(d.id); setReasonDraft(d.reason||''); }}>
                      {d.reason || <span className="muted">Add reason…</span>}
                      <svg className="pencil" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      </svg>
                    </span>
                  )}
                </td>
                <td><span className="row-act" onClick={() => del(d.id)}>Remove</span></td>
              </tr>
            ))}
            {!days.length && <tr><td colSpan={3} className="muted">No days off yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= REELS (upload video/thumbnail OR paste link) ================= */
function Reels({ supabase }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ client_name: '', service: 'Bridal', look: '', video_url: '' });
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [mode, setMode] = useState('upload'); // 'upload' | 'link'
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editVideo, setEditVideo] = useState(null);
  const [editThumb, setEditThumb] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const load = () => supabase.from('reels').select('*').order('sort_order').then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  async function uploadTo(bucketPath, file) {
    const ext = file.name.split('.').pop();
    const path = `${bucketPath}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('reels').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('reels').getPublicUrl(path);
    return data.publicUrl;
  }

  async function add() {
    if (!form.client_name.trim()) return alert('Enter a client name.');
    setBusy(true); setProgress('');
    try {
      let videoUrl = form.video_url.trim();
      let thumbUrl = '';

      if (mode === 'upload') {
        if (!videoFile) { setBusy(false); return alert('Choose a photo or video file, or switch to link mode.'); }
        const isImage = videoFile.type.startsWith('image/');
        setProgress(isImage ? 'Uploading photo…' : 'Uploading video…');
        videoUrl = await uploadTo(isImage ? 'photo' : 'video', videoFile);
      }
      if (thumbFile) {
        setProgress('Uploading thumbnail…');
        thumbUrl = await uploadTo('thumb', thumbFile);
      }

      setProgress('Saving…');
      await supabase.from('reels').insert({
        client_name: form.client_name, service: form.service, look: form.look,
        video_url: videoUrl, thumbnail_url: thumbUrl || null,
        sort_order: rows.length + 1, published: true,
      });

      setForm({ client_name: '', service: 'Bridal', look: '', video_url: '' });
      setVideoFile(null); setThumbFile(null); setProgress('');
      load();
    } catch (e) {
      alert('Upload failed: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }
  function startEdit(r) {
    setEditId(r.id);
    setEditForm({ client_name: r.client_name || '', service: r.service || 'Bridal', look: r.look || '', video_url: r.video_url || '' });
    setEditVideo(null); setEditThumb(null);
  }
  function cancelEdit() { setEditId(null); setEditForm({}); setEditVideo(null); setEditThumb(null); }

  async function saveEdit(r) {
    setEditBusy(true);
    try {
      const patch = { client_name: editForm.client_name, service: editForm.service, look: editForm.look };
      if (editVideo) { const isImg = editVideo.type.startsWith('image/'); setProgress(isImg ? 'Uploading photo…' : 'Uploading video…'); patch.video_url = await uploadTo(isImg ? 'photo' : 'video', editVideo); }
      else if (editForm.video_url !== r.video_url) { patch.video_url = editForm.video_url; }
      if (editThumb) { setProgress('Uploading thumbnail…'); patch.thumbnail_url = await uploadTo('thumb', editThumb); }
      await supabase.from('reels').update(patch).eq('id', r.id);
      setProgress(''); cancelEdit(); load();
    } catch (e) {
      alert('Update failed: ' + (e.message || e));
    } finally { setEditBusy(false); }
  }

  async function del(id) { await supabase.from('reels').delete().eq('id', id); load(); }

  return (
    <div>
      <div className="panel-head"><h3>Client Reels</h3></div>
      <p className="muted">Upload a photo or video (with an optional thumbnail), or paste a link.</p>

      <div className="reel-uploader pop">
        <div className="reel-form-row">
          <input className="fld" placeholder="Client name *" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
          <select className="fld" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
            <option>Bridal</option><option>Special Occasion</option><option>Photoshoot</option><option>Glam Class</option>
          </select>
          <input className="fld" placeholder="Look (e.g. Soft glam)" value={form.look} onChange={e => setForm({ ...form, look: e.target.value })} />
        </div>

        <div className="reel-mode">
          <button className={'chip' + (mode === 'upload' ? ' on' : '')} onClick={() => setMode('upload')}>Upload photo / video</button>
          <button className={'chip' + (mode === 'link' ? ' on' : '')} onClick={() => setMode('link')}>Paste link</button>
        </div>

        {mode === 'upload' ? (
          <label className="drop">
            <input type="file" accept="image/*,video/*" hidden onChange={e => setVideoFile(e.target.files[0])} />
            <span className="drop-ico">⬆</span>
            <span>{videoFile ? videoFile.name : 'Choose a photo or video (jpg, png, mp4, mov…)'}</span>
          </label>
        ) : (
          <input className="fld" placeholder="Video link (Instagram, TikTok, YouTube, Mux…)" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} />
        )}

        <label className="drop small">
          <input type="file" accept="image/*" hidden onChange={e => setThumbFile(e.target.files[0])} />
          <span className="drop-ico">🖼</span>
          <span>{thumbFile ? thumbFile.name : 'Optional: thumbnail image'}</span>
        </label>

        <button className="btn" onClick={add} disabled={busy}>{busy ? (progress || 'Working…') : '+ Publish Reel'}</button>
      </div>

      <div className="reel-manage">
        {rows.map(r => (
          <div className={'reel-mcard pop' + (editId === r.id ? ' editing' : '')} key={r.id}>
            {editId === r.id ? (
              <div className="reel-edit">
                <div className="reel-edit-row">
                  <input className="fld" placeholder="Client name" value={editForm.client_name} onChange={e => setEditForm({ ...editForm, client_name: e.target.value })} />
                  <select className="fld" value={editForm.service} onChange={e => setEditForm({ ...editForm, service: e.target.value })}>
                    <option>Bridal</option><option>Special Occasion</option><option>Photoshoot</option><option>Glam Class</option>
                  </select>
                </div>
                <input className="fld" placeholder="Look" value={editForm.look} onChange={e => setEditForm({ ...editForm, look: e.target.value })} />
                <input className="fld" placeholder="Video link (or upload below)" value={editForm.video_url} onChange={e => setEditForm({ ...editForm, video_url: e.target.value })} />
                <label className="drop small">
                  <input type="file" accept="image/*,video/*" hidden onChange={e => setEditVideo(e.target.files[0])} />
                  <span className="drop-ico">⬆</span><span>{editVideo ? editVideo.name : 'Replace photo / video (optional)'}</span>
                </label>
                <label className="drop small">
                  <input type="file" accept="image/*" hidden onChange={e => setEditThumb(e.target.files[0])} />
                  <span className="drop-ico">🖼</span><span>{editThumb ? editThumb.name : 'Replace thumbnail (optional)'}</span>
                </label>
                <div className="reel-edit-actions">
                  <button className="btn" onClick={() => saveEdit(r)} disabled={editBusy}>{editBusy ? (progress || 'Saving…') : 'Save'}</button>
                  <button className="btn ghost" onClick={cancelEdit} disabled={editBusy}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="reel-mthumb">
                  {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" /> :
                    (r.video_url && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(r.video_url)) ? <img src={r.video_url} alt="" /> :
                    r.video_url ? <video src={r.video_url} muted /> :
                    <div className="reel-noimg">No preview</div>}
                </div>
                <div className="reel-minfo">
                  <strong>{r.client_name}</strong>
                  <div className="muted">{r.service}{r.look ? ' · ' + r.look : ''}</div>
                  <div className="reel-src muted">{r.video_url ? (r.video_url.includes('/reels/') ? (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(r.video_url) ? '🖼 photo' : '📹 video') : '🔗 link') : '—'}</div>
                </div>
                <div className="reel-mactions">
                  <button className="mini" onClick={() => startEdit(r)}>Edit</button>
                  <button className="mini no" onClick={() => del(r.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
        {!rows.length && <p className="muted">No reels yet.</p>}
      </div>
    </div>
  );
}

/* ================= MESSAGES tab (list → opens convo panel) ================= */
function Messages({ msgs, onOpen, onDelete }) {
  return (
    <div>
      <div className="panel-head"><h3>Messages</h3></div>
      <p className="muted">Click a message to open the conversation and reply.</p>
      <div style={{ marginTop: 16 }}>
        {msgs.map(m => (
          <div className={'msg pop' + (m.read ? '' : ' unread')} key={m.id}>
            <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => onOpen(m)}>
              <div className="who">{m.from_name || 'Anonymous'}{!m.read && <span className="dotnew" style={{ marginLeft: 8 }} />}</div>
              <div className="txt">{m.body}</div>
              <div className="muted" style={{ fontSize: '.72rem', marginTop: 4 }}>{m.from_email}{m.reply ? ' · replied ✓' : ''}</div>
            </div>
            <div className="msg-actions">
              <button className="mini" onClick={() => onOpen(m)}>Open</button>
              <button className="mini no" onClick={() => onDelete(m.id)}>Delete</button>
            </div>
          </div>
        ))}
        {!msgs.length && <p className="muted">No messages yet.</p>}
      </div>
    </div>
  );
}

/* ================= CONTACT INFO SETTINGS ================= */
function Settings({ supabase }) {
  const FIELDS = [
    ['phone', 'Phone number', '(555) 123-4567'],
    ['email', 'Email address', 'hello@glambycass.com'],
    ['location', 'Location', 'Los Angeles, CA'],
    ['instagram', 'Instagram link', 'https://instagram.com/…'],
    ['tiktok', 'TikTok link', 'https://tiktok.com/@…'],
  ];
  const [vals, setVals] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => { if (data) setVals(data); });
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from('settings').update({
      phone: vals.phone, email: vals.email, location: vals.location,
      instagram: vals.instagram, tiktok: vals.tiktok, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div className="panel-head"><h3>Contact Info</h3></div>
      <p className="muted">Edit what clients see on your Contact page. Changes go live right away — no code needed.</p>
      <div className="settings-form pop">
        {FIELDS.map(([key, label, ph]) => (
          <div className="set-field" key={key}>
            <label>{label}</label>
            <input className="fld" placeholder={ph} value={vals[key] || ''} onChange={e => setVals({ ...vals, [key]: e.target.value })} />
          </div>
        ))}
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}</button>
      </div>
    </div>
  );
}

/* ================= EMAILS (editable templates) ================= */
function Emails({ supabase }) {
  const KEYS = Object.keys(EMAIL_DEFAULTS); // '_footer' is stored separately, not a card
  const [saved, setSaved] = useState({});       // key -> row from DB
  const [openKey, setOpenKey] = useState(null);
  const [draft, setDraft] = useState({ subject: '', title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const bodyRef = useRef(null);

  // Footer line shown at the bottom of every email (reserved key '_footer')
  const [footer, setFooter] = useState(FOOTER_DEFAULT);
  const [footerBusy, setFooterBusy] = useState(false);
  const [footerFlash, setFooterFlash] = useState('');

  const load = () => supabase.from('email_templates').select('*').then(({ data }) => {
    const m = {}; (data || []).forEach(r => { m[r.key] = r; });
    setSaved(m);
    setFooter((m._footer?.body || '').trim() || FOOTER_DEFAULT);
  });

  async function saveFooter() {
    setFooterBusy(true);
    const { error } = await supabase.from('email_templates').upsert({
      key: '_footer',
      subject: '',           // unused for the footer row, but kept non-null
      title: '',
      body: footer,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    setFooterBusy(false);
    if (error) {
      console.error('[footer save failed]', error);
      setFooterFlash('Could not save: ' + (error.message || 'unknown error'));
      setTimeout(() => setFooterFlash(''), 6000);
      return;                // don't reload — keep what she typed
    }
    setFooterFlash('Saved ✓');
    load();
    setTimeout(() => setFooterFlash(''), 2500);
  }

  async function resetFooter() {
    setFooterBusy(true);
    await supabase.from('email_templates').delete().eq('key', '_footer');
    setFooter(FOOTER_DEFAULT);
    setFooterBusy(false); setFooterFlash('Reset ✓'); load();
    setTimeout(() => setFooterFlash(''), 2500);
  }
  useEffect(() => { load(); }, []);

  function open(key) {
    const def = EMAIL_DEFAULTS[key];
    const s = saved[key];
    setOpenKey(key);
    setDraft({
      subject: s?.subject || def.subject,
      title:   s?.title   || def.title,
      body:    s?.body    || def.body,
    });
    setFlash('');
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('email_templates').upsert({
      key: openKey,
      subject: draft.subject,
      title: draft.title,
      body: draft.body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    setBusy(false);
    if (error) {
      console.error('[template save failed]', error);
      setFlash('Could not save: ' + (error.message || 'unknown error'));
      setTimeout(() => setFlash(''), 6000);
      return;
    }
    setFlash('Saved ✓');
    load();
    setTimeout(() => setFlash(''), 2500);
  }

  async function reset() {
    if (!confirm('Restore this email to its original wording?')) return;
    setBusy(true);
    await supabase.from('email_templates').delete().eq('key', openKey);
    const def = EMAIL_DEFAULTS[openKey];
    setDraft({ subject: def.subject, title: def.title, body: def.body });
    setBusy(false); setFlash('Reset to original ✓'); load();
    setTimeout(() => setFlash(''), 2500);
  }

  // Insert text at the cursor position in the body box
  function insertAtCursor(snippet) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? draft.body.length;
    const next = draft.body.slice(0, start) + snippet + draft.body.slice(end);
    setDraft({ ...draft, body: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Wrap the selected text (for the Bold button)
  function wrapSelection(before, after) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const sel = draft.body.slice(start, end) || 'text';
    const next = draft.body.slice(0, start) + before + sel + after + draft.body.slice(end);
    setDraft({ ...draft, body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + sel.length);
    });
  }

  const def = openKey ? EMAIL_DEFAULTS[openKey] : null;

  // Sample values so the preview looks like a real email
  const SAMPLE = {
    name: 'Amina', service: 'Bridal Makeup', date: 'Saturday, 15 August',
    time: '10:00', deposit: '40', email: 'amina@example.com',
    phone: '+1 555 0134', reply: 'Yes, I have that date free — happy to book you in!',
  };

  return (
    <div>
      <div className="panel-head"><h3>Emails</h3></div>
      <p className="muted">These are the automatic emails your site sends. Click one to change the wording — everything else keeps working.</p>

      {!openKey && (
        <div className="mail-grid-cards">
          {KEYS.map((k, i) => {
            const d = EMAIL_DEFAULTS[k];
            const isEdited = !!saved[k];
            const meta = MAIL_META[k] || { to: 'client', ico: '✉' };
            return (
              <div className={'mail-card pop to-' + meta.to} key={k}
                   style={{ animationDelay: (i * 55) + 'ms' }}
                   onClick={() => open(k)}>
                <div className="mail-card-top">
                  <div className="mail-ico">{meta.ico}</div>
                  <span className={'mail-to ' + meta.to}>{meta.to === 'owner' ? 'To you' : 'To client'}</span>
                  {isEdited && <span className="mail-badge">edited</span>}
                </div>

                <strong className="mail-title">{d.label}</strong>
                <p className="mail-when">{d.who}</p>

                <div className="mail-subj-box">
                  <span className="msb-label">Subject</span>
                  <span className="msb-text">{saved[k]?.subject || d.subject}</span>
                </div>

                <div className="mail-card-foot">
                  <span className="mail-edit-cta">Edit wording<span className="mec-arrow">→</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openKey && def && (
        <div className="mail-editor pop">
          <div className="mail-ed-head">
            <button className="mini" onClick={() => setOpenKey(null)}>← All emails</button>
            <strong>{def.label}</strong>
            {flash && <span className="mail-flash">{flash}</span>}
          </div>
          <p className="muted mail-who">{def.who}</p>

          <div className="mail-grid">
            {/* ---- editor side ---- */}
            <div className="mail-fields">
              <label className="mail-label">Subject line</label>
              <input className="fld" value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} />

              <label className="mail-label">Heading (the big gold line)</label>
              <input className="fld" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />

              <label className="mail-label">Message</label>
              <div className="mail-toolbar">
                <button className="tb-btn" title="Bold the selected text" onClick={() => wrapSelection('<strong>', '</strong>')}><b>B</b></button>
                <button className="tb-btn" title="New line" onClick={() => insertAtCursor('<br>')}>↵ line</button>
                <button className="tb-btn" title="Blank line between paragraphs" onClick={() => insertAtCursor('<br><br>')}>¶ gap</button>
              </div>
              <textarea ref={bodyRef} className="fld mail-body" rows={9}
                value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />

              <div className="mail-tags">
                <span className="muted">Click to insert:</span>
                {def.tags.map(t => (
                  <button key={t} className="tag-chip" onClick={() => insertAtCursor(`{{${t}}}`)}>{TAG_LABELS[t] || t}</button>
                ))}
              </div>
              <p className="muted mail-hint">Those gold chips fill in automatically when the email sends — leave them in place and write around them.</p>

              <div className="mail-actions">
                <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button className="btn ghost" onClick={reset} disabled={busy}>Reset to original</button>
              </div>
            </div>

            {/* ---- live preview ---- */}
            <div className="mail-preview-wrap">
              <label className="mail-label">Preview</label>
              <div className="mail-preview">
                <div className="mp-brand">GLAM <i>By Cass</i></div>
                <div className="mp-card">
                  <div className="mp-title">{fillTags(draft.title, SAMPLE)}</div>
                  <div className="mp-body" dangerouslySetInnerHTML={{ __html: fillTags(draft.body, SAMPLE) }} />
                </div>
                <div className="mp-foot">{footer || FOOTER_DEFAULT}</div>
              </div>
              <p className="muted mail-hint">Shown with example details so you can see the finished look.</p>

              <div className="fe-inline">
                <label className="mail-label" style={{marginTop:0}}>Email footer <span className="muted">(applies to all emails)</span></label>
                <div className="fe-row">
                  <input className="fld" value={footer} onChange={e => setFooter(e.target.value)} placeholder={FOOTER_DEFAULT} />
                  <button className="btn" onClick={saveFooter} disabled={footerBusy}>{footerBusy ? 'Saving…' : 'Save'}</button>
                  <button className="btn ghost" onClick={resetFooter} disabled={footerBusy}>Reset</button>
                </div>
                {footerFlash && <span className="mail-flash">{footerFlash}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MAIL_META = {
  received:        { to: 'client', ico: '✧' },
  confirmed:       { to: 'client', ico: '✓' },
  declined:        { to: 'client', ico: '○' },
  cancelledClient: { to: 'client', ico: '×' },
  messageReply:    { to: 'client', ico: '❝' },
  ownerNewMessage: { to: 'owner',  ico: '💌' },
  ownerNewBooking: { to: 'owner',  ico: '★' },
  ownerCancelled:  { to: 'owner',  ico: '!' },
};

const TAG_LABELS = {
  name: 'Client name', service: 'Service', date: 'Date', time: 'Time',
  deposit: 'Deposit', email: 'Client email', phone: 'Client phone', reply: 'Your reply',
};
