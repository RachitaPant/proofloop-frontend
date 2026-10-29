import nodemailer from 'nodemailer';
import type { EmailStatus } from '@proofloop/shared';

export interface Mail {
  to: string;
  /** Where replies go: a real person's address reads as personal, not bulk. */
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

type Transport = (mail: Mail) => Promise<void>;

// Which service delivers mail is configuration, not code:
//   MAIL_PROVIDER=smtp    SMTP_HOST/PORT/USER/PASS  (e.g. Gmail with an app password)
//   MAIL_PROVIDER=resend  RESEND_API_KEY            (needs a verified domain to reach anyone but yourself)
//   MAIL_PROVIDER=console prints the email instead of sending it (local development)
// Without MAIL_PROVIDER it is inferred from whichever credentials are set, and
// with none the app still works: invites show a link to copy and share.
export type MailProvider = 'smtp' | 'resend' | 'console' | 'none';

export function mailProvider(): MailProvider {
  const chosen = process.env.MAIL_PROVIDER?.toLowerCase();
  if (chosen === 'smtp' || chosen === 'resend' || chosen === 'console' || chosen === 'none') return chosen;
  if (process.env.SMTP_HOST) return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  return process.env.NODE_ENV === 'production' ? 'none' : 'console';
}

// A serverless function is frozen once it responds, so mail is awaited, and the
// timeouts stay well inside the function's own limit.
const TIMEOUT_MS = 8000;

function smtpFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || 'ProofLoop <no-reply@localhost>';
}

const smtp: Transport = async (mail) => {
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  await transporter.sendMail({ from: smtpFrom(), ...mail });
};

const resend: Transport = async (mail) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'ProofLoop <onboarding@resend.dev>',
      to: [mail.to],
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

let override: Transport | null = null;
/** Tests capture outgoing mail instead of sending it. Pass null to restore. */
export function setMailTransportForTests(transport: Transport | null) {
  override = transport;
}

/**
 * Sends one email. Never throws: the caller reports the outcome to the user
 * (a failed email must not undo whatever caused it). Provider errors are
 * logged without the message body.
 */
export async function sendMail(mail: Mail): Promise<EmailStatus> {
  if (override) {
    await override(mail);
    return 'sent';
  }

  const provider = mailProvider();
  if (provider === 'none') return 'not_configured';
  if (provider === 'console') {
    console.log(`[mail:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return 'not_configured';
  }

  try {
    await (provider === 'smtp' ? smtp : resend)(mail);
    return 'sent';
  } catch (err) {
    console.error(`Sending mail via ${provider} failed:`, (err as Error).message);
    return 'failed';
  }
}
