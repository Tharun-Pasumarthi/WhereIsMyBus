import nodemailer from 'nodemailer';

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.local'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const transport = createTransport();
  await transport.sendMail({
    from: `"Where Is My Bus" <${process.env.SMTP_USER}>`,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    text: opts.text ?? opts.html.replace(/<[^>]*>/g, ''),
    html: opts.html,
  });
}

// ─── Pre-built templates ──────────────────────────────────────────────────────

export function passwordResetEmail(resetLink: string, name = 'there'): MailOptions['html'] {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#161b22;border-radius:12px;overflow:hidden;border:1px solid #21262d">
    <div style="background:#f59e0b;padding:24px;text-align:center">
      <span style="font-size:28px">🚌</span>
      <h1 style="margin:8px 0 0;color:#0d1117;font-size:20px;font-weight:700">Where Is My Bus</h1>
    </div>
    <div style="padding:32px 28px">
      <h2 style="color:#e6edf3;font-size:18px;margin:0 0 12px">Hi ${name},</h2>
      <p style="color:#8d96a0;font-size:14px;line-height:1.6;margin:0 0 24px">
        We received a request to reset your password. Click the button below to set a new password.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetLink}" 
           style="display:inline-block;background:#f59e0b;color:#0d1117;text-decoration:none;font-weight:700;font-size:14px;padding:12px 32px;border-radius:8px">
          Reset Password
        </a>
      </div>
      <p style="color:#6e7681;font-size:12px;margin:20px 0 0;text-align:center">
        This link expires in 1 hour. If you didn&apos;t request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#0d1117;padding:16px;text-align:center">
      <p style="color:#6e7681;font-size:11px;margin:0">© ${new Date().getFullYear()} Where Is My Bus · College Transport System</p>
    </div>
  </div>
</body>
</html>`;
}

export function sosAlertEmail(driverName: string, busNumber: string, location: string): MailOptions['html'] {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#161b22;border-radius:12px;border:2px solid #ef4444;overflow:hidden">
    <div style="background:#ef4444;padding:20px;text-align:center">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🚨 SOS ALERT</h1>
    </div>
    <div style="padding:28px">
      <p style="color:#e6edf3;font-size:16px;margin:0 0 16px;font-weight:600">Emergency alert from Bus ${busNumber}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="color:#8d96a0;padding:6px 0">Driver:</td><td style="color:#e6edf3;font-weight:600">${driverName}</td></tr>
        <tr><td style="color:#8d96a0;padding:6px 0">Bus Number:</td><td style="color:#e6edf3;font-weight:600">${busNumber}</td></tr>
        <tr><td style="color:#8d96a0;padding:6px 0">Last Known Location:</td><td style="color:#e6edf3">${location}</td></tr>
        <tr><td style="color:#8d96a0;padding:6px 0">Time:</td><td style="color:#e6edf3">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
      </table>
      <p style="color:#ef4444;font-size:13px;margin:20px 0 0;font-weight:600">Please respond immediately and contact the driver or emergency services.</p>
    </div>
  </div>
</body>
</html>`;
}

export function attendanceConfirmEmail(studentName: string, busNumber: string, routeName: string, time: string): MailOptions['html'] {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#161b22;border-radius:12px;border:1px solid #21262d;overflow:hidden">
    <div style="background:#10b981;padding:20px;text-align:center">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700">✅ Boarding Confirmed</h1>
    </div>
    <div style="padding:28px">
      <p style="color:#e6edf3;font-size:15px;margin:0 0 16px">Hi, ${studentName} has boarded the bus.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="color:#8d96a0;padding:6px 0">Bus:</td><td style="color:#e6edf3;font-weight:600">${busNumber}</td></tr>
        <tr><td style="color:#8d96a0;padding:6px 0">Route:</td><td style="color:#e6edf3">${routeName}</td></tr>
        <tr><td style="color:#8d96a0;padding:6px 0">Time:</td><td style="color:#e6edf3">${time}</td></tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}
