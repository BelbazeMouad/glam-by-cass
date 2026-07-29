import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public: services + which DAYS are fully unavailable + which TIMES are
// already taken on each day + contact settings.
//
// NOTE: a single booking no longer blocks the whole day — only Cass's
// days off do. Individual times are blocked via `bookedTimes`, so several
// clients can book different times on the same date.
export async function GET() {
  try {
    const admin = supabaseAdmin();

    const [{ data: services }, { data: daysOff }, { data: bookings }, { data: settings }] = await Promise.all([
      admin.from('services').select('*').eq('active', true).order('sort_order'),
      admin.from('days_off').select('off_date, reason'),
      admin.from('bookings')
        .select('booking_date, booking_time, status, paid')
        .neq('status', 'cancelled'),
      admin.from('settings').select('*').eq('id', 1).single(),
    ]);

    // Days Cass has blocked off entirely
    const unavailable = (daysOff || []).map(d => d.off_date);

    const reasonMap = {};
    (daysOff || []).forEach(d => { if (d.reason) reasonMap[d.off_date] = d.reason; });

    // Times already taken, grouped by date: { '2026-08-15': ['14:00','16:30'] }
    const bookedTimes = {};
    (bookings || []).forEach(b => {
      if (!b.booking_date || !b.booking_time) return;
      // Count a slot as taken once it's paid, or while it's pending payment
      if (!b.paid && b.status !== 'pending') return;
      (bookedTimes[b.booking_date] ||= []).push(b.booking_time);
    });

    return Response.json({
      services: services || [],
      unavailable,
      reasonMap,
      bookedTimes,
      settings: settings || null,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
