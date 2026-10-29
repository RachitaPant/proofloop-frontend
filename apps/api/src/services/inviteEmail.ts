import type { Role } from '@proofloop/shared';
import type { Mail } from './mailer.service';

const ROLE_LABEL: Record<Role, string> = {
  USER: 'a team member who submits requests',
  REVIEWER: 'a reviewer who approves requests',
  ADMIN: 'an admin',
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Names are typed by users, so they're stripped of line breaks before reaching
// a subject (header injection) and escaped before reaching HTML.
const LINE_BREAKS = new RegExp(`[${String.fromCharCode(10, 13, 0x2028, 0x2029)}]+`, 'g');
const oneLine = (s: string) => s.replace(LINE_BREAKS, ' ').trim();

interface InviteEmailInput {
  to: string;
  orgName: string;
  inviterName: string;
  role: Role;
  link: string;
  expiresAt: Date;
}

export function buildInviteEmail({ to, orgName, inviterName, role, link, expiresAt }: InviteEmailInput): Mail {
  const org = oneLine(orgName);
  const inviter = oneLine(inviterName);
  const expires = expiresAt.toUTCString().replace(/ GMT$/, ' UTC');

  const text = [
    `${inviter} invited you to join ${org} on ProofLoop as ${ROLE_LABEL[role]}.`,
    '',
    `Accept the invitation: ${link}`,
    '',
    `The link works once and expires on ${expires}. If you weren't expecting this, you can ignore this email.`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f6fa;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2434;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 16px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7686;">ProofLoop</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Join ${escapeHtml(org)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(org)}</strong> as ${escapeHtml(ROLE_LABEL[role])}.</p>
        <p style="margin:0 0 24px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2f5bea;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;">Accept invitation</a></p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7686;">Or paste this link into your browser:<br><span style="word-break:break-all;">${escapeHtml(link)}</span></p>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7686;">The link works once and expires on ${escapeHtml(expires)}. If you weren't expecting this, you can ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { to, subject: `${inviter} invited you to ${org} on ProofLoop`, text, html };
}
