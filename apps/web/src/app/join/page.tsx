'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MailX, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useInvitePreview } from '@/lib/queries';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

const ROLE_LABEL = { USER: 'Member', REVIEWER: 'Reviewer', ADMIN: 'Admin' } as const;

function JoinForm() {
  const token = useSearchParams().get('token');
  const { register } = useAuth();
  const preview = useInvitePreview(token);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token || preview.isError || (preview.data && !preview.data.valid)) {
    return (
      <EmptyState
        icon={MailX}
        title="This invite link isn't valid"
        description="It may have expired, been used already, or been replaced by a newer one. Ask the person who invited you to send a new invite."
        action={
          <Link href="/login" className="text-sm font-medium text-brand-600 hover:underline">
            Go to sign in
          </Link>
        }
      />
    );
  }
  if (!preview.data) return <Spinner full />;

  const { orgName, role, email } = preview.data;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ name, email: email!, password, inviteToken: token });
    } catch {
      // register() already showed the error.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-surface-200">
      <p className="text-center text-sm text-navy-500">You&rsquo;ve been invited to join</p>
      <h1 className="font-display text-2xl font-bold text-navy-900 text-center mt-1 break-words">{orgName}</h1>
      <div className="flex justify-center mt-3">
        <Badge tone="brand">as {ROLE_LABEL[role ?? 'USER']}</Badge>
      </div>

      <form onSubmit={submit} className="space-y-4 mt-6">
        <Input label="Email" type="email" autoComplete="email" value={email ?? ''} readOnly hint="Your invite is tied to this address" />
        <Input label="Your name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Join {orgName}
        </Button>
      </form>

      <p className="text-center mt-4 text-sm text-navy-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:text-brand-700 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-surface-50 via-white to-brand-50">
      <div className="max-w-md mx-auto px-4 py-12">
        <Link
          href="/"
          aria-label="ProofLoop home"
          className="flex items-center justify-center gap-2 font-display text-3xl font-bold text-navy-900 mb-8"
        >
          <ShieldCheck className="w-8 h-8 text-brand-600" />
          Proof<span className="text-brand-600">Loop</span>
        </Link>
        <Suspense fallback={<Spinner full />}>
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
