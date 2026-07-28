import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, buildTemplate } from '@/lib/email';

export async function POST(req) {
  try {
    const { messageId, reply } = await req.json();
    if (!messageId || !reply?.trim()) return Response.json({ error: 'Missing reply' }, { status: 400 });
    const admin = supabaseAdmin();
    const { data: m } = await admin.from('messages').select('*').eq('id', messageId).single();
    if (!m) return Response.json({ error: 'Not found' }, { status: 404 });

    await admin.from('messages').update({ reply, replied_at: new Date().toISOString(), read: true }).eq('id', messageId);

    if (m.from_email) {
      const t = await buildTemplate('messageReply', {
        name: m.from_name || 'there',
        reply: reply.replace(/\n/g, '<br>'),
      });
      await sendEmail({ to: m.from_email, ...t });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
