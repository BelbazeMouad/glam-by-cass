import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ONE place controls the currency for the whole payment flow.
// Set NEXT_PUBLIC_CURRENCY in your env to 'usd' or 'eur' (defaults to usd).
// This MUST match the currency your Stripe account is set to, or Stripe
// will convert/behave oddly and the charged amount won't match what's shown.
const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY || 'usd').toLowerCase();

export async function POST(req) {
  try {
    const { serviceId, date, time, name, email, phone } = await req.json();

    if (!serviceId || !date || !name?.trim() || !email?.trim()) {
      return Response.json({ error: 'Name and email are required to book.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ error: 'Please enter a valid email.' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Look up the service to get its current deposit (Cass may have edited it)
    const { data: service, error: sErr } = await admin
      .from('services').select('*').eq('id', serviceId).single();
    if (sErr || !service) {
      return Response.json({ error: 'Service not found' }, { status: 404 });
    }

    // The deposit, as a clean number. This is exactly what will be charged.
    const deposit = Number(service.deposit);
    if (!Number.isFinite(deposit) || deposit <= 0) {
      return Response.json({ error: 'This service has no valid deposit set.' }, { status: 400 });
    }
    const price = Number(service.price) || 0;
    const balance = Math.max(price - deposit, 0);

    // Guard: is the date already unavailable?
    const { data: taken } = await admin
      .from('public_unavailable_dates').select('date').eq('date', date);
    if (taken && taken.length > 0) {
      return Response.json({ error: 'That date is no longer available' }, { status: 409 });
    }

    // Create a pending booking first.
    // Record the exact amount + currency we're about to charge, so the
    // dashboard always shows the truth (not a mismatched number).
    const { data: booking, error: bErr } = await admin.from('bookings').insert({
      client_name: name,
      client_email: email,
      client_phone: phone,
      service_id: service.id,
      service_name: service.name,
      booking_date: date,
      booking_time: time,
      deposit_amount: deposit,
      status: 'pending',
      paid: false,
    }).select().single();
    if (bErr) {
      return Response.json({ error: bErr.message }, { status: 500 });
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Stripe wants the amount in the smallest currency unit (cents).
    const unitAmount = Math.round(deposit * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: `${service.name} — Deposit`,
            description: `Booking deposit for ${date}${time ? ' at ' + time : ''}. Balance (${balance.toFixed(2)}) paid on the day.`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      metadata: { booking_id: String(booking.id) },
      success_url: `${site}/booking-confirmed?b=${booking.id}`,
      cancel_url: `${site}/#book`,
    });

    await admin.from('bookings').update({ stripe_session: session.id }).eq('id', booking.id);

    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
