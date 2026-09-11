const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

  if (!host || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_PORT !== '587',
    auth: user ? { user, pass } : undefined,
  });

  return transporter;
};

const fromAddress = () => process.env.GROW_EMAIL_FROM || process.env.SMTP_FROM || 'Grow+ <grow@curi.app>';

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) return { sent: false, reason: 'no_recipient' };

  const transport = getTransporter();
  if (!transport) {
    logger.info(`[email:dev] To: ${to} | ${subject}`);
    if (text) logger.info(`[email:dev] ${text.slice(0, 500)}`);
    return { sent: false, reason: 'dev_log_only' };
  }

  try {
    await transport.sendMail({
      from: fromAddress(),
      to,
      subject,
      html,
      text,
    });
    return { sent: true };
  } catch (err) {
    logger.warn(`Email send failed to ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
};

const sendGrowPurchaseConfirmation = async ({ campaign, guestEmail, guestName }) => {
  const email = guestEmail || campaign.guestEmail;
  if (!email) return { sent: false };

  const name = guestName || campaign.guestName || 'there';
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0];
  const trackUrl = `${clientUrl}/grow?email=${encodeURIComponent(email)}`;

  const subject = `Grow+ order confirmed — ${campaign.name}`;
  const text = [
    `Hi ${name},`,
    '',
    `Your Grow+ campaign "${campaign.name}" is confirmed.`,
    `Budget: $${campaign.budgetUsd} · Status: ${campaign.status}`,
    `Platforms: ${(campaign.platforms || []).join(', ')}`,
    '',
    `Track your campaign: ${trackUrl}`,
    '',
    '— Curi Grow+',
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#16a34a">Grow+ order confirmed</h2>
      <p>Hi ${name},</p>
      <p>Your campaign <strong>${campaign.name}</strong> is live.</p>
      <ul>
        <li><strong>Budget:</strong> $${campaign.budgetUsd}</li>
        <li><strong>Status:</strong> ${campaign.status}</li>
        <li><strong>Platforms:</strong> ${(campaign.platforms || []).join(', ')}</li>
      </ul>
      <p><a href="${trackUrl}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">View campaign dashboard</a></p>
      <p style="color:#666;font-size:12px">Real audience acquisition only — no bots or fake followers.</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text });
};

const sendGrowEnterpriseInquiry = async ({ email, name, message, packageName }) => {
  const salesTo = process.env.GROW_SALES_EMAIL || process.env.SMTP_FROM || 'sales@curi.app';
  const subject = `Grow+ Enterprise inquiry — ${name || email}`;
  const text = `Enterprise Grow+ inquiry\n\nName: ${name}\nEmail: ${email}\nPackage: ${packageName}\n\n${message || ''}`;

  await sendEmail({ to: salesTo, subject, text, html: `<pre>${text}</pre>` });
  return sendEmail({
    to: email,
    subject: 'We received your Grow+ Enterprise inquiry',
    text: `Hi ${name || 'there'},\n\nThanks for your interest in Grow+ Enterprise. Our team will contact you within 1 business day.\n\n— Curi Grow+`,
    html: `<p>Hi ${name || 'there'},</p><p>Thanks for your interest in Grow+ Enterprise. Our team will contact you within 1 business day.</p>`,
  });
};

module.exports = {
  sendEmail,
  sendGrowPurchaseConfirmation,
  sendGrowEnterpriseInquiry,
};
