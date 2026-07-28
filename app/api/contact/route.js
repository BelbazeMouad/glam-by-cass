import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { name, email, body } = await req.json();
    if (!name?.trim() || !email?.trim() || !body?.trim()) {
      return Response.json({ error: 'Name, email and message are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ error: 'Invalid email.' }, { status: 400 });
    }
    const admin = supabaseAdmin();
    await admin.from('messages').insert({ from_name: name, from_email: email, body });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
