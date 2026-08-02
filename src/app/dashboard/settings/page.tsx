'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string | null;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  max_users: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  
  const [companyName, setCompanyName] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Get company if exists
        if (profileData.company_id) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profileData.company_id)
            .single();

          if (companyData) {
            setCompany(companyData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCompany(true);
    setMessage('');

    try {
      if (!profile) throw new Error('No profile found');

      const slug = companyName.toLowerCase().replace(/\s+/g, '-');

      // Create company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          slug: slug,
          plan: 'free',
          max_users: 5,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Update profile to admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: newCompany.id,
          role: 'admin',
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      setMessage('Company created! You are now an admin. Refreshing...');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleBecomeManager = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'manager' })
        .eq('id', profile.id);

      if (error) throw error;

      setMessage('You are now a manager! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleBecomeEmployee = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'employee' })
        .eq('id', profile.id);

      if (error) throw error;

      setMessage('You are now an employee! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-gray-800">Settings</h1>
            <p className="text-gray-600">Manage your account and company</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-gray-600 hover:text-primary-600 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">
            {message}
          </div>
        )}

        {/* Profile Info */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Profile Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium text-gray-800">{profile?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium text-gray-800">{profile?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Role:</span>
              <span className="font-semibold text-primary-600 capitalize">{profile?.role}</span>
            </div>
          </div>
        </div>

        {/* Company Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Company</h2>
          
          {company ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Company Name:</span>
                <span className="font-medium text-gray-800">{company.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="font-medium text-gray-800 capitalize">{company.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Users:</span>
                <span className="font-medium text-gray-800">{company.max_users}</span>
              </div>
              
              {(profile?.role === 'manager' || profile?.role === 'admin') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link
                    href="/dashboard/team"
                    className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
                  >
                    View Team Dashboard →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">You don't have a company yet. Create one to access team features.</p>
              
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Acme Corp"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {creatingCompany ? 'Creating...' : 'Create Company & Become Admin'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Role Management (Development Only) */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Role Management 
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">DEV ONLY</span>
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            For testing purposes. In production, only admins can change roles.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={handleBecomeEmployee}
              disabled={profile?.role === 'employee'}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {profile?.role === 'employee' ? '✓ Employee' : 'Become Employee'}
            </button>
            
            <button
              onClick={handleBecomeManager}
              disabled={profile?.role === 'manager' || !profile?.company_id}
              className="flex-1 px-4 py-2 border-2 border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {profile?.role === 'manager' ? '✓ Manager' : 'Become Manager'}
            </button>
          </div>
          
          {!profile?.company_id && (
            <p className="text-xs text-gray-500 mt-2">
              * You need a company to become a manager
            </p>
          )}
        </div>

        {/* Sign Out */}
        <div className="mt-8 text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
