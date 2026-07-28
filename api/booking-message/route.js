import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

// Sends a one-off message from Cass to a specific booking's client email.
// Used by the "Email" button in the Bookings tab (separate from the
// booking-confirmed/declined templates — this is a free-form note).
export async function POST(req) {
  try {
    const { bookingId, subject, body } = await req.json();
    if (!bookingId || !body?.trim()) {
      return Response.json({ error: 'Message is empty.' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: b } = await admin.from('bookings').select('*').eq('id', bookingId).single();
    if (!b) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (!b.client_email) return Response.json({ error: 'This client has no email on file.' }, { status: 400 });

    const result = await sendEmail({
      to: b.client_email,
      subject: subject?.trim() || `A message from Glam by Cass`,
      title: `Hi ${b.client_name},`,
      body: body.replace(/\n/g, '<br>'),
    });

    if (result?.error) {
      return Response.json({ error: typeof result.error === 'string' ? result.error : 'Could not send.' }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
