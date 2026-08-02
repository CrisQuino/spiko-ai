'use client';

import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClientComponentClient();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      {/* Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-lg flex items-center justify-center font-mono text-white font-bold">
                &lt;/&gt;
              </div>
              <div>
                <h1 className="text-white font-mono font-bold text-xl">SPEECK.AI</h1>
                <p className="text-emerald-400 text-xs font-mono">// admin.dashboard</p>
              </div>
            </a>
            
            <nav className="flex items-center space-x-6">
              <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                dashboard()
              </a>
              <a href="/" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                home()
              </a>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/');
                }}
                className="text-red-400 hover:text-red-300 transition-colors font-mono text-sm"
              >
                logout()
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
