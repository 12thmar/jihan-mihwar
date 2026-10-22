import axios from 'axios';

const BREVO = 'https://api.brevo.com/v3/smtp/email';

function brevoHeaders() {
  return {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
  };
}

function jihanHtml(d) {
  const row = (label, val) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#888;font-size:13px;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:14px;color:${val ? '#1c1408' : '#bbb'}">${val || '—'}</td></tr>`;
  return `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f9f4ea;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2d5b8;padding:32px">
  <h2 style="color:#c8820a;margin:0 0 4px">New Commission Enquiry</h2>
  <p style="color:#888;font-size:13px;margin:0 0 24px">Submitted via byjihan.com</p>
  <table style="width:100%;border-collapse:collapse">
    ${row('Name',      `${d.fname} ${d.lname}`.trim())}
    ${row('Email',     d.email)}
    ${row('WhatsApp',  d.phone)}
    ${row('Source',    d.source)}
  </table>
  <hr style="border:none;border-top:1px solid #e2d5b8;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    ${row('Series',    d.series)}
    ${row('Size',      d.size)}
    ${row('Verse',     d.verse)}
    ${row('Custom text', d.customText)}
    ${row('Mood',      d.mood)}
  </table>
  <hr style="border:none;border-top:1px solid #e2d5b8;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    ${row('Purpose',   d.purpose)}
    ${row('Culture',   d.culture)}
    ${row('Budget',    d.budget)}
    ${row('Needed by', d.deadline)}
    ${row('Notes',     d.notes ? `<em>${d.notes}</em>` : '')}
  </table>
</div>
</body></html>`;
}

function clientHtml(fname) {
  return `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f9f4ea;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2d5b8;padding:40px;text-align:center">
  <div style="font-size:48px;color:#c8820a;margin-bottom:8px">شكراً</div>
  <h2 style="color:#1c1408;font-size:20px;margin:0 0 12px">Enquiry received, ${fname}</h2>
  <p style="color:#5a4e35;font-size:15px;line-height:1.8;margin:0 0 24px">
    جزاك الله خيراً — Jihan will review your vision<br>and be in touch within 2–3 days.
  </p>
  <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">byjihan.com</p>
</div>
</body></html>`;
}

export async function handleCommission(req, res) {
  const d = req.body;

  if (!d.fname || !d.email) {
    return res.status(400).json({ error: 'fname and email are required' });
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const jihanEmail  = process.env.JIHAN_EMAIL;

  if (!process.env.BREVO_API_KEY || !senderEmail || !jihanEmail) {
    console.error('Missing BREVO_API_KEY, BREVO_SENDER_EMAIL, or JIHAN_EMAIL');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    await Promise.all([
      // Notification to Jihan
      axios.post(BREVO, {
        sender:      { name: 'byjihan commissions', email: senderEmail },
        to:          [{ email: jihanEmail, name: 'Jihan' }],
        replyTo:     { email: d.email, name: `${d.fname} ${d.lname}`.trim() },
        subject:     `New Commission — ${d.fname} ${d.lname || ''}`.trim(),
        htmlContent: jihanHtml(d),
      }, { headers: brevoHeaders() }),

      // Confirmation to client
      axios.post(BREVO, {
        sender:      { name: 'Jihan', email: senderEmail },
        to:          [{ email: d.email, name: d.fname }],
        subject:     'شكراً — Your commission enquiry',
        htmlContent: clientHtml(d.fname),
      }, { headers: brevoHeaders() }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Brevo error:', detail);
    res.status(502).json({ error: 'Failed to send email', detail });
  }
}
