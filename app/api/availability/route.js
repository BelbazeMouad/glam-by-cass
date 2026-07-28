import { supabaseAdmin } from '@/lib/supabase';

// Never cache — always return the live services/availability so admin edits
// (deleting a service, blocking a day) show on the site immediately.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public: returns active services + list of unavailable dates for the calendar.
export async function GET() {
  try {
    const admin = supabaseAdmin();
    const [{ data: services }, { data: unavailable }, { data: daysOff }, { data: settings }] = await Promise.all([
      admin.from('services').select('*').eq('active', true).order('sort_order'),
      admin.from('public_unavailable_dates').select('date'),
      admin.from('days_off').select('off_date, reason'),
      admin.from('settings').select('*').eq('id', 1).single(),
    ]);

    // Build a reason map: date → reason (only days_off have reasons; booked dates have none)
    const reasonMap = {};
    (daysOff || []).forEach(d => { if (d.reason) reasonMap[d.off_date] = d.reason; });

    return Response.json({
      services: services || [],
      unavailable: (unavailable || []).map(r => r.date),
      reasonMap,
      settings: settings || null,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
