import axios from 'axios';

const BREVO = 'https://api.brevo.com/v3/smtp/email';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function brevoHeaders() {
  return { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' };
}

function jihanHtml(d) {
  const row = (label, val) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#888;font-size:13px;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:14px;color:${val ? '#1c1408' : '#bbb'}">${val ? esc(val) : '—'}</td></tr>`;
  return `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f9f4ea;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2d5b8;padding:32px">
  <h2 style="color:#c8820a;margin:0 0 4px">New Reservation Request</h2>
  <p style="color:#888;font-size:13px;margin:0 0 24px">Submitted via byjihan.com · “Reserve This Piece”</p>
  <table style="width:100%;border-collapse:collapse">
    ${row('Piece',    d.piece)}
    ${row('Arabic',   d.arabic)}
    ${row('Price',    d.price)}
  </table>
  <hr style="border:none;border-top:1px solid #e2d5b8;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    ${row('Name',     `${d.fname || ''} ${d.lname || ''}`.trim())}
    ${row('Email',    d.email)}
    ${row('WhatsApp', d.phone)}
    ${row('Message',  d.message)}
  </table>
</div>
</body></html>`;
}

function clientHtml(fname, piece) {
  return `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f9f4ea;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2d5b8;padding:40px;text-align:center">
  <div style="font-size:48px;color:#c8820a;margin-bottom:8px">شكراً</div>
  <h2 style="color:#1c1408;font-size:20px;margin:0 0 12px">Request received, ${esc(fname)}</h2>
  <p style="color:#5a4e35;font-size:15px;line-height:1.8;margin:0 0 24px">
    Thank you for your interest in <em>${esc(piece)}</em>.<br>
    Jihan will confirm availability and next steps within 1–2 days.
  </p>
  <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">byjihan.com</p>
</div>
</body></html>`;
}

export async function handleReserve(req, res) {
  const d = req.body || {};

  if (!d.fname || !d.email || !d.piece) {
    return res.status(400).json({ error: 'fname, email and piece are required' });
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const jihanEmail  = process.env.JIHAN_EMAIL;

  if (!process.env.BREVO_API_KEY || !senderEmail || !jihanEmail) {
    console.error('Missing BREVO_API_KEY, BREVO_SENDER_EMAIL, or JIHAN_EMAIL');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const fullName = `${d.fname} ${d.lname || ''}`.trim();

  try {
    // Notification to Jihan (must succeed)
    await axios.post(BREVO, {
      sender:      { name: 'byjihan reservations', email: senderEmail },
      to:          [{ email: jihanEmail, name: 'Jihan' }],
      replyTo:     { email: d.email, name: fullName },
      subject:     `Reservation request — ${d.piece} — ${fullName}`,
      htmlContent: jihanHtml(d),
    }, { headers: brevoHeaders() });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Brevo error (reserve → Jihan):', detail);
    return res.status(502).json({ error: 'Failed to send email', detail });
  }

  // Confirmation to buyer (best effort — don't fail the request if this bounces)
  try {
    await axios.post(BREVO, {
      sender:      { name: 'Jihan', email: senderEmail },
      to:          [{ email: d.email, name: d.fname }],
      subject:     `شكراً — Your request for ${d.piece}`,
      htmlContent: clientHtml(d.fname, d.piece),
    }, { headers: brevoHeaders() });
  } catch (err) {
    console.error('Brevo error (reserve → client):', err.response?.data || err.message);
  }

  res.json({ ok: true });
}
