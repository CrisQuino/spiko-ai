'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      console.log('✅ Login successful, redirecting...');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'azure' | 'github') => {
    try {
      console.log(`🔐 Starting OAuth login with ${provider}`);
      console.log('📍 Redirect URL:', config.urls.callback);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: config.urls.callback,
        },
      });

      console.log('🔐 OAuth response:', { data, error });

      if (error) throw error;
      
      console.log('✅ OAuth initiated successfully');
    } catch (err: any) {
      console.error('❌ OAuth error:', err);
      setError(err.message || `Failed to login with ${provider}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20 relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="max-w-md w-full">
        <Link href="/" className="inline-flex items-center text-cyan-600 mb-8 hover:text-emerald-600 transition-colors font-mono text-sm">
          <span className="mr-2">←</span> cd ../home
        </Link>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass rounded-2xl p-8 border border-gray-200/50"
        >
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-white text-2xl font-mono shadow-xl">
              &lt;/&gt;
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-mono gradient-text mb-2">
              auth.login()
            </h1>
            <p className="text-gray-600 font-mono text-sm">
              <span className="text-gray-400">// </span>Access your training dashboard
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full py-3 glass border border-gray-300 rounded-xl font-mono text-sm hover:border-cyan-500 hover:shadow-lg transition-all flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-gray-400">&gt;</span>
              <span>auth.google()</span>
            </button>
            <button
              onClick={() => handleOAuthLogin('azure')}
              className="w-full py-3 glass border border-gray-300 rounded-xl font-mono text-sm hover:border-cyan-500 hover:shadow-lg transition-all flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f25022" d="M0 0h11v11H0z"/>
                <path fill="#00a4ef" d="M12 0h11v11H12z"/>
                <path fill="#7fba00" d="M0 12h11v11H0z"/>
                <path fill="#ffb900" d="M12 12h11v11H12z"/>
              </svg>
              <span className="text-gray-400">&gt;</span>
              <span>auth.microsoft()</span>
            </button>
            <button
              onClick={() => handleOAuthLogin('github')}
              className="w-full py-3 glass border border-gray-300 rounded-xl font-mono text-sm hover:border-cyan-500 hover:shadow-lg transition-all flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-gray-400">&gt;</span>
              <span>auth.github()</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-mono">// or use email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-mono">$</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full pl-10 pr-4 py-3 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200/50"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-mono">$</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200/50"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 font-mono">
                  <span className="text-red-400">// error: </span>{error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white rounded-xl font-mono font-semibold hover:shadow-xl disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>&gt; authenticating()</span>
                </span>
              ) : (
                <span>&gt; authenticate()</span>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center space-y-2">
            <Link href="/auth/signup" className="block text-sm font-mono text-cyan-600 hover:text-emerald-600 transition-colors">
              auth.signup() <span className="text-gray-400">// create account</span>
            </Link>
            <Link href="/" className="block text-sm font-mono text-gray-500 hover:text-gray-700 transition-colors">
              <span className="text-gray-400">←</span> cd ../home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
