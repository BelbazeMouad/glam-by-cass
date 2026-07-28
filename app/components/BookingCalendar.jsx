'use client';
import { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, addMonths, isBefore, startOfToday } from 'date-fns';

const TIMES = ['10:00', '12:30', '14:00', '16:30'];

export default function BookingCalendar() {
  const [services, setServices] = useState([]);
  const [unavailable, setUnavailable] = useState(new Set());
  const [reasonMap, setReasonMap] = useState({});
  const [serviceId, setServiceId] = useState(null);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState('10:00');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [tooltip, setTooltip] = useState(null); // { key, reason }

  useEffect(() => {
    fetch('/api/availability')
      .then(r => r.json())
      .then(d => {
        setServices(d.services || []);
        if (d.services?.length) setServiceId(d.services[0].id);
        setUnavailable(new Set(d.unavailable || []));
        setReasonMap(d.reasonMap || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const service = services.find(s => s.id === serviceId);
  const today = startOfToday();
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks = getDay(startOfMonth(month));

  function dayState(d) {
    const key = format(d, 'yyyy-MM-dd');
    if (isBefore(d, today)) return 'past';
    if (unavailable.has(key)) return 'off';
    return 'avail';
  }

  async function book() {
    setErr('');
    if (!service) return setErr('Please pick a service.');
    if (!selDate) return setErr('Please choose an available date.');
    if (!name.trim()) return setErr('Please enter your name.');
    if (!email.trim()) return setErr('Please enter your email — we send your confirmation there.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('That email doesn\u2019t look right — please check it.');
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          date: format(selDate, 'yyyy-MM-dd'),
          time: selTime,
          name, email, phone,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setErr(data.error || 'Something went wrong.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="booking glass"><p className="muted">Loading availability…</p></div>;

  return (
    <div className="book-grid">
      {/* SERVICES */}
      <div className="svc glass">
        {services.map(s => (
          <div key={s.id}
            className={'svc-row' + (s.id === serviceId ? ' active' : '')}
            onClick={() => setServiceId(s.id)}>
            <div>
              <h4>{s.name}</h4>
              <div className="sub">{s.description}</div>
            </div>
            <div className="price">€{Number(s.price).toFixed(0)}</div>
          </div>
        ))}
      </div>

      {/* CALENDAR + DETAILS */}
      <div className="booking glass">
        <div className="cal-head">
          <button onClick={() => setMonth(addMonths(month, -1))} disabled={isBefore(startOfMonth(month), addMonths(today, 0))}>‹</button>
          <h3>{format(month, 'MMMM yyyy')}</h3>
          <button onClick={() => setMonth(addMonths(month, 1))}>›</button>
        </div>
        <div className="muted">Greyed days are unavailable</div>

        <div className="cal" onMouseLeave={() => setTooltip(null)}>
          {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="dow">{d}</div>)}
          {Array.from({ length: leadingBlanks }).map((_, i) => <div key={'b'+i} />)}
          {days.map(d => {
            const st = dayState(d);
            const key = format(d, 'yyyy-MM-dd');
            const isSel = selDate && format(selDate, 'yyyy-MM-dd') === key;
            const reason = reasonMap[key];
            return (
              <div key={key}
                className={'day ' + st + (isSel ? ' sel' : '') + (st === 'off' && reason ? ' has-reason' : '')}
                onClick={() => st === 'avail' && setSelDate(d)}
                onMouseEnter={() => st === 'off' ? setTooltip({ key }) : setTooltip(null)}
                title="">
                {format(d, 'd')}
                {st === 'off' && tooltip?.key === key && (
                  <div className="day-tooltip">
                    <span className="dt-label">Day off</span>
                    {reason && <><span className="dt-sep">:</span><span className="dt-reason">{reason}</span></>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="muted" style={{ marginBottom: 10 }}>Available times</div>
        <div className="slots">
          {TIMES.map(t => (
            <div key={t} className={'slot' + (t === selTime ? ' sel' : '')} onClick={() => setSelTime(t)}>{t}</div>
          ))}
        </div>

        <div className="form-mini">
          <input className={err && !name.trim() ? 'invalid' : ''} placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} required />
          <input className={err && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ? 'invalid' : ''} type="email" placeholder="Email * (for your confirmation)" value={email} onChange={e => setEmail(e.target.value)} required />
          <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
          <div className="req-note">* Required — we email your booking confirmation here.</div>
        </div>

        {service && (
          <div className="pay-note">
            <span className="dot" />
            <div>A <strong>€{Number(service.deposit).toFixed(0)}</strong> deposit confirms your booking.
              Balance €{(Number(service.price) - Number(service.deposit)).toFixed(0)} paid on the day.</div>
          </div>
        )}

        {err && <div className="err">{err}</div>}

        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={book} disabled={submitting}>
          {submitting ? 'Redirecting to payment…' : 'Pay Deposit & Confirm'}
        </button>
        <div className="pm-row">
          <span className="pm">Visa</span><span className="pm">Mastercard</span>
          <span className="pm">Apple Pay</span><span className="pm">Google Pay</span>
        </div>
      </div>
    </div>
  );
}
