import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, buildTemplate } from '@/lib/email';

// Called from the dashboard when Cass accepts or declines a booking.
export async function POST(req) {
  try {
    const { bookingId, action } = await req.json();
    if (!bookingId || !['accept', 'decline'].includes(action)) {
      return Response.json({ error: 'Bad request' }, { status: 400 });
    }
    const admin = supabaseAdmin();
    const { data: b } = await admin.from('bookings').select('*').eq('id', bookingId).single();
    if (!b) return Response.json({ error: 'Not found' }, { status: 404 });

    const newStatus = action === 'accept' ? 'confirmed' : 'cancelled';
    const patch = { status: newStatus };
    if (action === 'decline') {
      patch.cancelled_at = new Date().toISOString();
      patch.cancelled_by = 'admin';
    }
    await admin.from('bookings').update(patch).eq('id', bookingId);

    // Notify the client
    if (b.client_email) {
      const vars = {
        name: b.client_name,
        service: b.service_name,
        date: b.booking_date,
        time: b.booking_time,
        deposit: b.deposit_amount,
        email: b.client_email,
        phone: b.client_phone,
      };
      if (action === 'accept') {
        const t = await buildTemplate('confirmed', vars);
        await sendEmail({ to: b.client_email, ...t, cancelToken: b.cancel_token });
      } else {
        const t = await buildTemplate('declined', vars);
        await sendEmail({ to: b.client_email, ...t });
      }
    }

    return Response.json({ ok: true, status: newStatus });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
