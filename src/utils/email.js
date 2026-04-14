const nodemailer = require('nodemailer');

const createTransporter = () =>
  nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const formatCurrency = (n) => `₹${Number(n).toFixed(2)}`;

// ── Build HTML email body ─────────────────────────────────────────
const buildOrderEmail = ({ customer, bikes, total }) => {
  const bikeRows = bikes.map(b => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
        <strong style="color:#1e1b4b;">${b.name}</strong><br/>
        <span style="font-size:12px;color:#6b7280;">${b.brand} &middot; ${b.type}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;">
        ${formatDate(b.startTime)}<br/>
        <span style="color:#9ca3af;">to</span><br/>
        ${formatDate(b.endTime)}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;">
        ${b.days} day${b.days > 1 ? 's' : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">
        ${b.discountAmount > 0
          ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:12px;">${formatCurrency(b.totalAmount)}</span><br/>`
          : ''}
        <span style="font-size:12px;color:#6b7280;">Base: ${formatCurrency(b.afterDiscount)}</span><br/>
        <span style="font-size:12px;color:#6b7280;">GST 18%: ${formatCurrency(b.gst)}</span><br/>
        <strong style="color:#7c3aed;">${formatCurrency(b.finalAmount)}</strong>
        ${b.promoCode ? `<br/><span style="font-size:11px;color:#059669;">🏷 ${b.promoCode}</span>` : ''}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,.12);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 36px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">🏍️ New Booking Order</h1>
            <p style="margin:8px 0 0;color:#c4b5fd;font-size:14px;">BikeRental Platform</p>
          </td>
        </tr>

        <!-- Customer details -->
        <tr>
          <td style="padding:28px 36px 8px;">
            <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1e1b4b;text-transform:uppercase;letter-spacing:.06em;">Customer Details</h2>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-bottom:10px;">
                  <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Full name</span><br/>
                  <span style="font-size:15px;font-weight:600;color:#111827;">${customer.name}</span>
                </td>
                <td width="50%" style="padding-bottom:10px;">
                  <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Email</span><br/>
                  <span style="font-size:15px;color:#111827;">${customer.email}</span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:10px;">
                  <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Phone</span><br/>
                  <span style="font-size:15px;color:#111827;">${customer.phone}</span>
                </td>
                <td style="padding-bottom:10px;">
                  <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Alternative Phone</span><br/>
                  <span style="font-size:15px;color:#111827;">${customer.altPhone || '—'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 36px;"><hr style="border:none;border-top:1px solid #e5e7eb;"/></td></tr>

        <!-- Bike details -->
        <tr>
          <td style="padding:20px 36px 8px;">
            <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1e1b4b;text-transform:uppercase;letter-spacing:.06em;">Booking Details</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f5f3ff;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Motorbike</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Duration</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Days</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Amount</th>
                </tr>
              </thead>
              <tbody>${bikeRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Total -->
        <tr>
          <td style="padding:16px 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="right" style="padding:12px 16px;background:#f5f3ff;border-radius:10px;">
                  <span style="font-size:14px;color:#6b7280;">Grand Total &nbsp;</span>
                  <span style="font-size:22px;font-weight:800;color:#7c3aed;">${formatCurrency(total)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e1b4b;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#a78bfa;">This order was placed via BikeRental &mdash; ${new Date().toLocaleString('en-IN')}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ── Send order confirmation to admin ──────────────────────────────
const sendOrderEmail = async ({ customer, bikes, total }) => {
  const transporter = createTransporter();

  const bikeNames = bikes.map(b => b.name).join(', ');

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || `BikeRental <${process.env.SMTP_USER}>`,
    to:      process.env.ADMIN_EMAIL,
    subject: `🏍️ New Booking Order — ${customer.name} (${bikeNames})`,
    html:    buildOrderEmail({ customer, bikes, total }),
  });
};

module.exports = { sendOrderEmail };
