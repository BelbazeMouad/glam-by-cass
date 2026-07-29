'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// useSearchParams() must sit inside a Suspense boundary, so the page
// is a thin wrapper around the real content.
export default function CancelPage() {
  return (
    <Suspense fallback={
      <div className="cancel-wrap"><div className="cancel-card"><p className="muted">Loading…</p></div></div>
    }>
      <CancelInner />
    </Suspense>
  );
}

function CancelInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [state, setState] = useState('loading'); // loading|found|notfound|confirming|done|already|error
  const [booking, setBooking] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    fetch(`/api/cancel-booking?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || d.error) { setState('notfound'); return; }
        setBooking(d.booking);
        setState(d.booking.status === 'cancelled' ? 'already' : 'found');
      })
      .catch(() => setState('error'));
  }, [token]);

  async function doCancel() {
    setState('confirming');
    try {
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setErr(d.error || 'Something went wrong.'); setState('found'); return; }
      setState('done');
    } catch (e) {
      setErr('Something went wrong. Please try again.');
      setState('found');
    }
  }

  return (
    <div className="cancel-wrap">
      <div className="cancel-card">
        <img className="cancel-crest" src="/glam-round.png" alt="Glam by Cass" />

        {state === 'loading' && <p className="muted">Loading your booking…</p>}

        {(state === 'notfound' || state === 'error') && (
          <>
            <h1 className="gold-text">Link not found</h1>
            <p className="muted">This cancellation link isn&apos;t valid or has expired. If you need help, just reply to your booking email and Cass will sort it out.</p>
            <a className="btn ghost" href="/">Back to site</a>
          </>
        )}

        {state === 'already' && (
          <>
            <h1 className="gold-text">Already cancelled</h1>
            <p className="muted">This booking has already been cancelled. Nothing more to do.</p>
            <a className="btn ghost" href="/">Back to site</a>
          </>
        )}

        {(state === 'found' || state === 'confirming') && booking && (
          <>
            <h1 className="gold-text">Cancel your booking?</h1>

            <div className="cancel-details">
              <div className="cd-row"><span>Name</span><strong>{booking.client_name}</strong></div>
              <div className="cd-row"><span>Service</span><strong>{booking.service_name}</strong></div>
              <div className="cd-row"><span>Date</span><strong>{booking.booking_date}{booking.booking_time ? ` · ${booking.booking_time}` : ''}</strong></div>
            </div>

            <div className="cancel-warn">
              <div className="cw-ico">!</div>
              <div>
                <strong>Your deposit is non-refundable.</strong>
                <p>If you cancel, the ${booking.deposit_amount} deposit you paid won&apos;t be returned. Your date will be released for someone else.</p>
              </div>
            </div>

            {err && <div className="err">{err}</div>}

            <div className="cancel-actions">
              <button className="btn danger" onClick={doCancel} disabled={state === 'confirming'}>
                {state === 'confirming' ? 'Cancelling…' : 'Yes, cancel my booking'}
              </button>
              <a className="btn ghost" href="/">Keep my booking</a>
            </div>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="cancel-check">✓</div>
            <h1 className="gold-text">Booking cancelled</h1>
            <p className="muted">Your appointment has been cancelled and Cass has been notified. We&apos;ve sent you a confirmation email.</p>
            <p className="muted" style={{ marginTop: 10 }}>We&apos;d love to see you another time — you&apos;re always welcome to book a new date.</p>
            <a className="btn" href="/">Book another date</a>
          </>
        )}
      </div>
    </div>
  );
}
