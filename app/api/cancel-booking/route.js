import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, buildTemplate } from '@/lib/email';

export const dynamic = 'force-dynamic';

// GET — look up a booking by its secret token (so the page can show details
// before the client confirms). Returns only what's safe to display.
export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return Response.json({ error: 'Missing link code.' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: b } = await admin.from('bookings').select('*').eq('cancel_token', token).single();
    if (!b) return Response.json({ error: 'notfound' }, { status: 404 });

    return Response.json({
      booking: {
        client_name: b.client_name,
        service_name: b.service_name,
        booking_date: b.booking_date,
        booking_time: b.booking_time,
        deposit_amount: b.deposit_amount,
        status: b.status,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST — actually cancel it.
export async function POST(req) {
  try {
    const { token } = await req.json();
    if (!token) return Response.json({ error: 'Missing link code.' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: b } = await admin.from('bookings').select('*').eq('cancel_token', token).single();
    if (!b) return Response.json({ error: 'notfound' }, { status: 404 });
    if (b.status === 'cancelled') return Response.json({ ok: true, already: true });

    await admin.from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'client' })
      .eq('id', b.id);

    const vars = {
      name: b.client_name,
      service: b.service_name,
      date: b.booking_date,
      time: b.booking_time,
      deposit: b.deposit_amount,
      email: b.client_email,
      phone: b.client_phone,
    };

    // Confirm to the client
    if (b.client_email) {
      const t = await buildTemplate('cancelledClient', vars);
      await sendEmail({ to: b.client_email, ...t });
    }

    // Notify Cass
    let ownerEmail = process.env.OWNER_EMAIL;
    const { data: s } = await admin.from('settings').select('email').eq('id', 1).single();
    if (s?.email) ownerEmail = s.email;
    if (ownerEmail) {
      const ot = await buildTemplate('ownerCancelled', vars);
      await sendEmail({ to: ownerEmail, ...ot });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
