'use client';
import { useState, useEffect, useMemo } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, addMonths, isBefore, startOfToday } from 'date-fns';
import { allSlots, toHHMM, toLabel, isBlocked, blockingTime, GAP_MINUTES } from '@/lib/booking-times';

export default function BookingCalendar() {
  const [services, setServices] = useState([]);
  const [unavailable, setUnavailable] = useState(new Set());
  const [reasonMap, setReasonMap] = useState({});
  const [bookedTimes, setBookedTimes] = useState({});   // { 'yyyy-mm-dd': ['14:00', ...] }
  const [serviceId, setServiceId] = useState(null);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    fetch('/api/availability')
      .then(r => r.json())
      .then(d => {
        setServices(d.services || []);
        if (d.services?.length) setServiceId(d.services[0].id);
        setUnavailable(new Set(d.unavailable || []));
        setReasonMap(d.reasonMap || {});
        setBookedTimes(d.bookedTimes || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const service = services.find(s => s.id === serviceId);
  const today = startOfToday();
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks = getDay(startOfMonth(month));
  const dateKey = selDate ? format(selDate, 'yyyy-MM-dd') : null;

  // Times already taken on the chosen day
  const takenToday = useMemo(
    () => (dateKey ? (bookedTimes[dateKey] || []) : []),
    [dateKey, bookedTimes]
  );

  // Build the pickable time list for the chosen day, marking blocked ones
  const timeOptions = useMemo(() => {
    return allSlots().map(mins => {
      const blocked = isBlocked(mins, takenToday);
      return {
        mins,
        value: toHHMM(mins),
        label: toLabel(mins),
        blocked,
        because: blocked ? blockingTime(mins, takenToday) : null,
      };
    });
  }, [takenToday]);

  const morning = timeOptions.filter(t => t.mins < 12 * 60);
  const afternoon = timeOptions.filter(t => t.mins >= 12 * 60);
  const anyFree = timeOptions.some(t => !t.blocked);
  const selectedLabel = selTime ? toLabel(allSlots().find(m => toHHMM(m) === selTime) ?? 0) : '';

  function dayState(d) {
    const key = format(d, 'yyyy-MM-dd');
    if (isBefore(d, today)) return 'past';
    if (unavailable.has(key)) return 'off';
    return 'avail';
  }

  function pickDate(d) {
    setSelDate(d);
    setSelTime('');     // reset time — free slots differ per day
    setErr('');
  }

  async function book() {
    setErr('');
    if (!service) return setErr('Please pick a service first.');
    if (!selDate) return setErr('Please choose a date.');
    if (!selTime) return setErr('Please choose a time.');
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
      if (data.url) { window.location.href = data.url; return; }
      setErr(data.error || 'Something went wrong.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="booking glass"><p className="muted">Loading availability…</p></div>;

  return (
    <div className="book-grid">
      {/* ---------- STEP 1 — SERVICE ---------- */}
      <div className="svc glass">
        <div className="step-label"><span className="step-num">1</span> Choose your service</div>
        {services.map(s => (
          <div key={s.id}
            className={'svc-row' + (s.id === serviceId ? ' active' : '')}
            onClick={() => setServiceId(s.id)}>
            <div>
              <h4>{s.name}</h4>
              <div className="sub">{s.description}</div>
            </div>
            <div className="price">${Number(s.price).toFixed(0)}</div>
          </div>
        ))}
      </div>

      {/* ---------- CALENDAR + TIME + DETAILS ---------- */}
      <div className="booking glass">
        <div className="step-label"><span className="step-num">2</span> Pick a date</div>

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
            const isSel = dateKey === key;
            const reason = reasonMap[key];
            return (
              <div key={key}
                className={'day ' + st + (isSel ? ' sel' : '') + (st === 'off' && reason ? ' has-reason' : '')}
                onClick={() => st === 'avail' && pickDate(d)}
                onMouseEnter={() => st === 'off' ? setTooltip({ key }) : setTooltip(null)}>
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

        {/* ---------- STEP 3 — TIME ---------- */}
        <div className="step-label"><span className="step-num">3</span> Pick a time</div>

        {!selDate ? (
          <div className="time-empty">Choose a date above and your available times will appear here.</div>
        ) : !anyFree ? (
          <div className="time-empty full">Sorry — this day is fully booked. Please try another date.</div>
        ) : (
          <>
            <div className="time-chosen-row">
              {selTime
                ? <span className="time-chosen">Selected: <strong>{selectedLabel}</strong></span>
                : <span className="muted">Tap a time below</span>}
              <span className="time-legend"><i /> already booked</span>
            </div>

            <div className="time-scroll">
              {[['Morning', morning], ['Afternoon', afternoon]].map(([heading, list]) => (
                <div className="time-group" key={heading}>
                  <div className="time-group-head">{heading}</div>
                  <div className="time-list">
                    {list.map(t => (
                      <button key={t.value} type="button"
                        className={'time-pill' + (t.blocked ? ' taken' : '') + (selTime === t.value ? ' sel' : '')}
                        disabled={t.blocked}
                        title={t.blocked ? `Too close to a booking at ${t.because}` : ''}
                        onClick={() => { setSelTime(t.value); setErr(''); }}>
                        {t.label}
                        {t.blocked && <span className="tp-x">booked</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="time-note muted">Appointments are spaced {GAP_MINUTES} minutes apart, so some times may be unavailable.</div>
          </>
        )}

        {/* ---------- STEP 4 — DETAILS ---------- */}
        <div className="step-label"><span className="step-num">4</span> Your details</div>
        <div className="form-mini">
          <input className={err && !name.trim() ? 'invalid' : ''} placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} required />
          <input className={err && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ? 'invalid' : ''} type="email" placeholder="Email * (for your confirmation)" value={email} onChange={e => setEmail(e.target.value)} required />
          <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
          <div className="req-note">* Required — we email your booking confirmation here.</div>
        </div>

        {service && (
          <div className="pay-note">
            <span className="dot" />
            <div>A <strong>${Number(service.deposit).toFixed(0)}</strong> deposit confirms your booking.
              Balance ${(Number(service.price) - Number(service.deposit)).toFixed(0)} paid on the day.</div>
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
