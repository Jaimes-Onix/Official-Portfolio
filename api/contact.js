/**
 * POST /api/contact  — Vercel serverless function.
 *
 * Body:  { name, email, message }
 * Reply: { ok: true }        on success
 *        { error: string }   on failure (with an appropriate HTTP status)
 *
 * Sends the message to the site owner via Resend, with the visitor's address as
 * reply-to (so a plain "Reply" goes straight back to them). The Resend key stays
 * server-side (RESEND_API_KEY) and is never exposed to the browser.
 *
 * Env:
 *   RESEND_API_KEY  (required)  — from https://resend.com/api-keys
 *   CONTACT_TO      (optional)  — inbox that receives messages; defaults below
 *   RESEND_FROM     (optional)  — sender; defaults to Resend's shared domain,
 *                                 which delivers to your own Resend account email.
 *                                 Set a verified-domain address for full reliability.
 */

import { Resend } from 'resend';

const CONTACT_TO = process.env.CONTACT_TO || 'jaimesedwardcabante3@gmail.com';
const RESEND_FROM = process.env.RESEND_FROM || 'Portfolio Contact <onboarding@resend.dev>';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email isn’t configured yet. Please email me directly for now.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);

    if (!name || !isEmail(email) || !message) {
      return res.status(400).json({ error: 'Please include your name, a valid email, and a message.' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [CONTACT_TO],
      replyTo: email,
      subject: `New portfolio message from ${name}`,
      text: `${message}\n\n— ${name}\n${email}`,
      html: `<div style="font-family:system-ui,'Segoe UI',Arial,sans-serif;font-size:15px;color:#18181b;line-height:1.6">
        <p style="margin:0 0 2px"><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>
        <p style="margin:0 0 16px;color:#6f6a63">sent you a message from your portfolio:</p>
        <div style="padding:14px 16px;border-left:3px solid #f0530c;background:#faf7f4;border-radius:6px;white-space:pre-wrap">${esc(message)}</div>
        <p style="margin:16px 0 0;color:#8c8c86;font-size:12px">Reply directly to this email to respond to ${esc(name)}.</p>
      </div>`,
    });

    if (error) throw new Error(error.message || JSON.stringify(error));
    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('[api/contact]', err?.message || err);
    return res.status(502).json({ error: 'Couldn’t send your message. Please try again or email me directly.' });
  }
}
