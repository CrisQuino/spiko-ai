'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvitation();
  }, [params.token]);

  const loadInvitation = async () => {
    try {
      // Get invitation
      const { data: inviteData, error: inviteError } = await supabase
        .from('invitations')
        .select(`
          *,
          companies (
            id,
            name,
            plan
          )
        `)
        .eq('invite_token', params.token)
        .single();

      if (inviteError || !inviteData) {
        setError('Invalid or expired invitation link');
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(inviteData.expires_at) < new Date()) {
        setError('This invitation has expired');
        setLoading(false);
        return;
      }

      // Check if already accepted
      if (inviteData.status !== 'pending') {
        setError('This invitation has already been used');
        setLoading(false);
        return;
      }

      setInvitation(inviteData);
      setCompany(inviteData.companies);

      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // User is logged in - accept invitation automatically
        await acceptInvitation(user.id, inviteData);
      }
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (userId: string, invite: any) => {
    try {
      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: invite.company_id,
          role: invite.role,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (inviteError) throw inviteError;

      // Redirect to dashboard
      router.push('/dashboard?welcome=true');
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      setError('Failed to accept invitation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Show invitation details - user needs to signup
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-2">
            You're Invited!
          </h1>
          <p className="text-gray-600">Join your team on SPEECK.AI</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600 mb-3">
            <strong>{company?.name}</strong> has invited you to join their team as a{' '}
            <strong className="capitalize">{invitation?.role}</strong>
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Email: {invitation?.email}</p>
            <p>• Expires: {new Date(invitation?.expires_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href={`/auth/signup?invite=${params.token}`}
            className="block w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-center"
          >
            Create Account & Join Team
          </Link>
          
          <Link
            href={`/auth/login?invite=${params.token}`}
            className="block w-full px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all text-center"
          >
            Already have an account? Sign In
          </Link>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          By joining, you'll get access to team practice sessions and progress tracking
        </p>
      </div>
    </div>
  );
}
