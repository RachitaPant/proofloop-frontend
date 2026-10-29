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
  inviterEmail?: string;
  role: Role;
  link: string;
  expiresAt: Date;
}

// Deliberately plain: a short note with one link reads as personal mail, while
// heavily styled templates with buttons look like bulk mail to spam filters.
export function buildInviteEmail({ to, orgName, inviterName, inviterEmail, role, link, expiresAt }: InviteEmailInput): Mail {
  const org = oneLine(orgName);
  const inviter = oneLine(inviterName);
  const expires = expiresAt.toUTCString().replace(/ GMT$/, ' UTC');

  const text = [
    `Hi,`,
    '',
    `${inviter} added you to ${org} on ProofLoop, as ${ROLE_LABEL[role]}.`,
    '',
    `Join here: ${link}`,
    '',
    `The link works once and expires on ${expires}. If you don't know ${inviter}, just ignore this email.`,
    '',
    `Reply to this email to reach ${inviter}.`,
  ].join('\n');

  const html = `<p>Hi,</p>
<p>${escapeHtml(inviter)} added you to <strong>${escapeHtml(org)}</strong> on ProofLoop, as ${escapeHtml(ROLE_LABEL[role])}.</p>
<p>Join here: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
<p>The link works once and expires on ${escapeHtml(expires)}. If you don't know ${escapeHtml(inviter)}, just ignore this email.</p>
<p>Reply to this email to reach ${escapeHtml(inviter)}.</p>`;

  return { to, replyTo: inviterEmail, subject: `${inviter} added you to ${org} on ProofLoop`, text, html };
}
