import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, buildTemplate } from '@/lib/email';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  try {
    const { name, email, body } = await req.json();

    // Validate on the server too (not just the browser)
    if (!name?.trim())  return Response.json({ error: 'Please enter your name.' }, { status: 400 });
    if (!email?.trim() || !emailRe.test(email.trim()))
      return Response.json({ error: 'Please enter a valid email.' }, { status: 400 });
    if (!body?.trim())  return Response.json({ error: 'Please write a message.' }, { status: 400 });

    const admin = supabaseAdmin();

    // Save the message
    const { error } = await admin.from('messages').insert({
      from_name: name.trim(),
      from_email: email.trim(),
      body: body.trim(),
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Notify Cass — a simple heads-up. Goes to the email set in Contact Info,
    // or OWNER_EMAIL as a fallback.
    let ownerEmail = process.env.OWNER_EMAIL;
    const { data: s } = await admin.from('settings').select('email').eq('id', 1).single();
    if (s?.email) ownerEmail = s.email;
    if (ownerEmail) {
      const t = await buildTemplate('ownerNewMessage', { name: name.trim(), email: email.trim() });
      await sendEmail({ to: ownerEmail, ...t });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
