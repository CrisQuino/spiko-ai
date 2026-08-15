'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

type InviteInfo = {
  email: string;
  role: string;
  expires_at: string;
  status: string;
  company_name: string | null;
  company_suspended?: boolean;
  valid: boolean;
  reason?: string;
};

const REASON_MSG: Record<string, string> = {
  invalid: 'Invalid or expired invitation link',
  expired: 'This invitation has expired',
  used: 'This invitation has already been used',
  email_mismatch: 'This invitation is for a different email address',
  company_suspended: 'This company is currently suspended',
  company_full: 'This team has reached its member limit',
};

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { d } = useUi();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  const loadInvitation = async () => {
    try {
      const res = await fetch(`/api/invite/accept?token=${encodeURIComponent(params.token)}`);
      const data: InviteInfo = await res.json();
      if (!data.valid) {
        setError(REASON_MSG[data.reason || 'invalid'] || REASON_MSG.invalid);
        setLoading(false);
        return;
      }
      setInfo(data);

      // If already logged in, accept immediately.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await acceptInvitation(session.access_token);
      }
    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (accessToken: string) => {
    setAccepting(true);
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: params.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(REASON_MSG[data.error] || 'Failed to accept invitation');
        setAccepting(false);
        return;
      }
      router.push('/dashboard?welcome=true');
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Failed to accept invitation');
      setAccepting(false);
    }
  };

  if (loading || accepting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{d.invite.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{d.invite.invalid}</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
          >
            {d.invite.goHome}
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in — offer signup/login, carrying the invite token through.
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 w-full max-w-md">
        <div className="flex justify-end mb-2"><LanguageSwitcher className="text-gray-600" /></div>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-2">
            {d.invite.title}
          </h1>
          <p className="text-gray-600">{d.invite.subtitle}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600 mb-3">
            <strong>{info?.company_name}</strong> {d.invite.invitedAs}{' '}
            <strong className="capitalize">{info?.role}</strong>
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• {d.invite.email}: {info?.email}</p>
            <p>• {d.invite.expires}: {info?.expires_at ? new Date(info.expires_at).toLocaleDateString() : '—'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href={`/auth/signup?invite=${params.token}`}
            className="block w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-center"
          >
            {d.invite.createJoin}
          </Link>

          <Link
            href={`/auth/login?invite=${params.token}`}
            className="block w-full px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all text-center"
          >
            {d.invite.haveSignIn}
          </Link>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          {d.invite.benefits}
        </p>
      </div>
    </div>
  );
}
