import axios from 'axios';

const BREVO = 'https://api.brevo.com/v3/smtp/email';
const TOPICS = ['General question', 'Buying a piece', 'Commission', 'Exhibitions & press'];

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;

function brevoHeaders() {
  return { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' };
}

function jihanHtml(d) {
  const row = (label, val) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#888;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:14px;color:${val ? '#1c1408' : '#bbb'}">${val ? esc(val) : '—'}</td></tr>`;
  return `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f9f4ea;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2d5b8;padding:32px">
  <h2 style="color:#c8820a;margin:0 0 4px">New Message</h2>
  <p style="color:#888;font-size:13px;margin:0 0 24px">Submitted via byjihan.com · “Get in touch”</p>
  <table style="width:100%;border-collapse:collapse">
    ${row('Name',  d.name)}
    ${row('Email', d.email)}
    ${row('Topic', d.topic)}
  </table>
  <hr style="border:none;border-top:1px solid #e2d5b8;margin:20px 0">
  <div style="font-size:15px;line-height:1.7;color:#1c1408;white-space:pre-wrap">${esc(d.message)}</div>
</div>
</body></html>`;
}

function clientHtml(name) {
  return `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f9f4ea;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2d5b8;padding:40px;text-align:center">
  <div style="font-size:48px;color:#c8820a;margin-bottom:8px">شكراً</div>
  <h2 style="color:#1c1408;font-size:20px;margin:0 0 12px">Message received, ${esc(name)}</h2>
  <p style="color:#5a4e35;font-size:15px;line-height:1.8;margin:0 0 24px">
    Thank you for reaching out.<br>Jihan will reply within 1–2 days.
  </p>
  <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">byjihan.com</p>
</div>
</body></html>`;
}

export async function handleContact(req, res) {
  const d = req.body || {};

  // Honeypot: real visitors never see or fill the "website" field. Pretend success for bots.
  if (d.website) return res.json({ ok: true });

  const name    = String(d.name || '').trim().slice(0, 120);
  const email   = String(d.email || '').trim();
  const message = String(d.message || '').trim().slice(0, 5000);
  const topic   = TOPICS.includes(d.topic) ? d.topic : 'General question';

  if (!name || !isEmail(email) || !message) {
    return res.status(400).json({ error: 'name, a valid email and message are required' });
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const jihanEmail  = process.env.JIHAN_EMAIL;
  if (!process.env.BREVO_API_KEY || !senderEmail || !jihanEmail) {
    console.error('Missing BREVO_API_KEY, BREVO_SENDER_EMAIL, or JIHAN_EMAIL');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const data = { name, email, topic, message };

  try {
    await axios.post(BREVO, {
      sender:      { name: 'byjihan contact', email: senderEmail },
      to:          [{ email: jihanEmail, name: 'Jihan' }],
      replyTo:     { email, name },
      subject:     `${topic} — ${name}`,
      htmlContent: jihanHtml(data),
    }, { headers: brevoHeaders() });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Brevo error (contact → Jihan):', detail);
    return res.status(502).json({ error: 'Failed to send email', detail });
  }

  try {
    await axios.post(BREVO, {
      sender:      { name: 'Jihan', email: senderEmail },
      to:          [{ email, name }],
      subject:     'شكراً — Your message to Jihan',
      htmlContent: clientHtml(name),
    }, { headers: brevoHeaders() });
  } catch (err) {
    console.error('Brevo error (contact → client):', err.response?.data || err.message);
  }

  res.json({ ok: true });
}
