import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, buildTemplate } from '@/lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return Response.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id;
    if (bookingId) {
      const admin = supabaseAdmin();
      // Deposit paid: mark paid, and block the date. Status stays 'pending'
      // so Cass can accept/decline. (Date is blocked as soon as it's paid.)
      await admin.from('bookings')
        .update({ paid: true, status: 'pending' })
        .eq('id', bookingId);

      const { data: b } = await admin.from('bookings').select('*').eq('id', bookingId).single();

      if (b) {
        const vars = {
          name: b.client_name,
          service: b.service_name,
          date: b.booking_date,
          time: b.booking_time,
          deposit: b.deposit_amount,
          email: b.client_email,
          phone: b.client_phone,
        };

        // Client: "we received your booking" (with cancel link)
        if (b.client_email) {
          const t = await buildTemplate('received', vars);
          await sendEmail({ to: b.client_email, ...t, cancelToken: b.cancel_token });
        }

        // Cass: new booking alert. Uses the email set in Contact Info,
        // or OWNER_EMAIL as a fallback.
        let ownerEmail = process.env.OWNER_EMAIL?.trim();
        if (!ownerEmail) {
          const { data: s } = await admin.from('settings').select('email').eq('id', 1).single();
          ownerEmail = s?.email?.trim();
        }
        if (ownerEmail) {
          const ot = await buildTemplate('ownerNewBooking', vars);
          await sendEmail({ to: ownerEmail, ...ot });
        }
      }
    }
  }

  return Response.json({ received: true });
}
