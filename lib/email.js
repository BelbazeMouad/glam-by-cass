import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';

// Sends email via Resend. If no API key is configured yet, it safely no-ops
// (logs and returns) so the app keeps working until you add the key.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Glam by Cass <onboarding@resend.dev>';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// The footer line shown at the bottom of every email.
// Cass edits it in Admin → Emails (the "Email footer" box at the top).
// Stored in email_templates under the reserved key '_footer'.
export const FOOTER_DEFAULT = 'Glam by Cass · Los Angeles, CA';

function shell(title, body, footerExtra = '', footerText = FOOTER_DEFAULT) {
  return `<!doctype html><html><body style="margin:0;background:#080506;font-family:Georgia,serif;color:#e9e2d2;padding:0">
    <div style="max-width:520px;margin:0 auto;padding:40px 28px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:22px;letter-spacing:.14em;color:#e0a94a">GLAM <span style="font-style:italic">By Cass</span></div>
      </div>
      <div style="background:#140d0c;border:1px solid rgba(224,169,74,.24);border-radius:16px;padding:32px">
        <h1 style="font-size:22px;color:#e0a94a;margin:0 0 14px">${title}</h1>
        <div style="font-size:15px;line-height:1.7;color:#d8d3c4">${body}</div>
      </div>
      ${footerExtra}
      <p style="text-align:center;font-size:12px;color:#a39d8c;margin-top:20px">${footerText}</p>
    </div></body></html>`;
}

// A subtle "need to cancel?" block appended to client booking emails.
function cancelBlock(token) {
  if (!token) return '';
  const url = `${SITE}/cancel?token=${token}`;
  return `<div style="text-align:center;margin-top:18px">
      <p style="font-size:12px;color:#a39d8c;margin:0 0 6px">Plans changed?</p>
      <a href="${url}" style="font-size:12px;color:#e0a94a;text-decoration:underline">Cancel your booking</a>
      <p style="font-size:11px;color:#7d7768;margin:6px 0 0">Deposits are non-refundable.</p>
    </div>`;
}

async function getFooter() {
  try {
    const admin = supabaseAdmin();
    const { data } = await admin.from('email_templates').select('body').eq('key', '_footer').single();
    if (data && typeof data.body === 'string' && data.body.trim()) return data.body.trim();
  } catch (e) {
    // table missing or no row yet — use the default
  }
  return FOOTER_DEFAULT;
}

export async function sendEmail({ to, subject, title, body, cancelToken }) {
  if (!KEY || !to) { console.log('[email skipped — no RESEND_API_KEY or no recipient]', subject); return { skipped: true }; }
  try {
    const resend = new Resend(KEY);
    const footerText = await getFooter();
    const html = shell(title, body, cancelBlock(cancelToken), footerText);
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) { console.error('[email error]', error); return { error }; }
    return { data };
  } catch (e) {
    console.error('[email exception]', e);
    return { error: e.message };
  }
}

/* ============================================================
   EDITABLE TEMPLATES
   Cass edits these in Admin → Emails. Her version is stored in
   the `email_templates` table and used if present; otherwise
   these built-in defaults are used.

   Merge tags — replaced with real values when the email sends:
     {{name}} {{service}} {{date}} {{time}} {{deposit}}
     {{email}} {{phone}}
   ============================================================ */

export const EMAIL_DEFAULTS = {
  received: {
    label: 'Booking received',
    who: 'Sent to the client right after they pay their deposit.',
    tags: ['name', 'service', 'date', 'time', 'deposit'],
    subject: 'We received your booking ✨',
    title: 'Thank you, {{name}}!',
    body: `We've received your booking request for <strong>{{service}}</strong> on <strong>{{date}}</strong> at <strong>{{time}}</strong>.<br><br>Your ${{deposit}} deposit is confirmed. Cass will review and confirm your appointment shortly — you'll get another email once it's accepted.<br><br>We can't wait to glam you up!`,
  },
  confirmed: {
    label: 'Booking confirmed',
    who: 'Sent to the client when you click Accept on a booking.',
    tags: ['name', 'service', 'date', 'time'],
    subject: 'Your booking is confirmed 💛',
    title: `You're all set, {{name}}!`,
    body: `Great news — Cass has <strong>confirmed</strong> your {{service}} appointment on <strong>{{date}}</strong> at <strong>{{time}}</strong>.<br><br>See you then! If you need to make any changes, just reply to this email.`,
  },
  declined: {
    label: 'Booking declined',
    who: 'Sent to the client when you click Decline on a booking.',
    tags: ['name', 'service', 'date'],
    subject: 'About your booking request',
    title: 'Hi {{name}},',
    body: `Unfortunately Cass isn't available for your {{service}} request on <strong>{{date}}</strong>, so this booking couldn't be confirmed.<br><br>Please feel free to book another date — we'd love to work with you.`,
  },
  cancelledClient: {
    label: 'Cancellation confirmation',
    who: 'Sent to the client after they cancel using the link in their email.',
    tags: ['name', 'service', 'date', 'time'],
    subject: 'Your booking has been cancelled',
    title: 'Hi {{name}},',
    body: `Your <strong>{{service}}</strong> appointment on <strong>{{date}}</strong> at <strong>{{time}}</strong> has been cancelled.<br><br>As noted at booking, the deposit is non-refundable.<br><br>We'd love to see you another time — you're always welcome to book a new date.`,
  },
  ownerNewBooking: {
    label: 'New booking alert (to you)',
    who: 'Sent to your inbox whenever someone books and pays.',
    tags: ['name', 'service', 'date', 'time', 'deposit', 'email', 'phone'],
    subject: 'New booking — {{name}} · {{service}}',
    title: 'You have a new booking! 💛',
    body: `<strong>{{name}}</strong> just booked and paid a ${{deposit}} deposit.<br><br><strong>Service:</strong> {{service}}<br><strong>Date:</strong> {{date}} at {{time}}<br><strong>Email:</strong> {{email}}<br><strong>Phone:</strong> {{phone}}<br><br>Log in to your dashboard to accept or decline it. The date is already held for you.`,
  },
  ownerCancelled: {
    label: 'Cancellation alert (to you)',
    who: 'Sent to your inbox when a client cancels their booking.',
    tags: ['name', 'service', 'date', 'time', 'email', 'phone'],
    subject: 'Booking cancelled — {{name}} · {{service}}',
    title: 'A booking was cancelled',
    body: `<strong>{{name}}</strong> has cancelled their appointment.<br><br><strong>Service:</strong> {{service}}<br><strong>Was booked for:</strong> {{date}} at {{time}}<br><strong>Email:</strong> {{email}}<br><strong>Phone:</strong> {{phone}}<br><br>That date is now free again on your calendar. The deposit was non-refundable.`,
  },
  messageReply: {
    label: 'Reply to a message',
    who: 'The wrapper around replies you send from the Messages tab.',
    tags: ['name', 'reply'],
    subject: 'Re: your message to Glam by Cass',
    title: 'Hi {{name}},',
    body: `{{reply}}<br><br>— Cass`,
  },
  ownerNewMessage: {
    label: 'New message alert (to you)',
    who: 'Sent to your inbox when a client sends a message through the contact form.',
    tags: ['name', 'email'],
    subject: 'New message from {{name}}',
    title: 'You have a new message 💌',
    body: `<strong>{{name}}</strong> just sent you a message through your website.<br><br>Log in to your dashboard to read it and reply.`,
  },
};

// Swap {{tags}} for real values. Missing values become an em dash.
export function fillTags(text, vars = {}) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return (v === undefined || v === null || v === '') ? '—' : String(v);
  });
}

/**
 * Build an email from a template key, using Cass's saved version if she has
 * one, otherwise the default. Always falls back safely.
 */
export async function buildTemplate(key, vars = {}) {
  const def = EMAIL_DEFAULTS[key];
  if (!def) throw new Error(`Unknown email template: ${key}`);

  let saved = null;
  try {
    const admin = supabaseAdmin();
    const { data } = await admin.from('email_templates').select('*').eq('key', key).single();
    saved = data;
  } catch (e) {
    // table may not exist yet, or no row — just use defaults
  }

  const subject = (saved?.subject || '').trim() || def.subject;
  const title   = (saved?.title   || '').trim() || def.title;
  const body    = (saved?.body    || '').trim() || def.body;

  return {
    subject: fillTags(subject, vars),
    title:   fillTags(title, vars),
    body:    fillTags(body, vars),
  };
}

/* ------------------------------------------------------------
   Legacy helper — kept so any older code that imports
   `emailTemplates` still works. New code should use buildTemplate().
   ------------------------------------------------------------ */
export const emailTemplates = {
  received: (name, service, date, time, deposit) => ({
    subject: fillTags(EMAIL_DEFAULTS.received.subject, { name, service, date, time, deposit }),
    title:   fillTags(EMAIL_DEFAULTS.received.title,   { name, service, date, time, deposit }),
    body:    fillTags(EMAIL_DEFAULTS.received.body,    { name, service, date, time, deposit }),
  }),
  confirmed: (name, service, date, time) => ({
    subject: fillTags(EMAIL_DEFAULTS.confirmed.subject, { name, service, date, time }),
    title:   fillTags(EMAIL_DEFAULTS.confirmed.title,   { name, service, date, time }),
    body:    fillTags(EMAIL_DEFAULTS.confirmed.body,    { name, service, date, time }),
  }),
  declined: (name, service, date) => ({
    subject: fillTags(EMAIL_DEFAULTS.declined.subject, { name, service, date }),
    title:   fillTags(EMAIL_DEFAULTS.declined.title,   { name, service, date }),
    body:    fillTags(EMAIL_DEFAULTS.declined.body,    { name, service, date }),
  }),
  ownerNewBooking: (name, service, date, time, deposit, email, phone) => ({
    subject: fillTags(EMAIL_DEFAULTS.ownerNewBooking.subject, { name, service, date, time, deposit, email, phone }),
    title:   fillTags(EMAIL_DEFAULTS.ownerNewBooking.title,   { name, service, date, time, deposit, email, phone }),
    body:    fillTags(EMAIL_DEFAULTS.ownerNewBooking.body,    { name, service, date, time, deposit, email, phone }),
  }),
  ownerCancelled: (name, service, date, time, email, phone) => ({
    subject: fillTags(EMAIL_DEFAULTS.ownerCancelled.subject, { name, service, date, time, email, phone }),
    title:   fillTags(EMAIL_DEFAULTS.ownerCancelled.title,   { name, service, date, time, email, phone }),
    body:    fillTags(EMAIL_DEFAULTS.ownerCancelled.body,    { name, service, date, time, email, phone }),
  }),
};
