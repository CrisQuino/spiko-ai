'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      console.log('🚪 Logging out...');
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      console.log('✅ Logged out successfully');
      
      // Redirect to home after logout
      router.push('/');
    };

    logout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-mono">Logging out...</p>
      </div>
    </div>
  );
}
