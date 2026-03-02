import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL_USER || 'support@pool-league-manager.com',
    pass: process.env.ZOHO_EMAIL_PASSWORD,
  },
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  if (!process.env.ZOHO_EMAIL_PASSWORD) {
    console.warn('[email] ZOHO_EMAIL_PASSWORD not set, skipping email');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Pool League Manager" <${process.env.ZOHO_EMAIL_USER || 'support@pool-league-manager.com'}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('[email] Failed to send:', error);
    return false;
  }
}
