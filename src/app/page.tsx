'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

// Prices + which plan is highlighted (not translated).
const PLAN_META = [
  { price: 0, popular: false },
  { price: 12, popular: true },
  { price: 299, popular: false },
];

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const { d } = useUi();
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    setLoading(false);
  };
  
  const handleGetStarted = () => {
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/auth/signup');
    }
  };
  
  const handleLogin = () => {
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/auth/login');
    }
  };
  
  return (
    <main className="min-h-screen">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-200/50"
      >
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-lg flex items-center justify-center font-mono text-white font-bold text-sm relative overflow-hidden group">
              <span className="relative z-10">&lt;/&gt;</span>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-cyan-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-mono font-bold gradient-text">
                SPEECK.AI
              </span>
              <span className="text-[10px] font-mono text-gray-500 -mt-1">// code your communication</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-cyan-600 transition-colors font-mono text-sm">features()</a>
            <a href="#how-it-works" className="text-gray-700 hover:text-cyan-600 transition-colors font-mono text-sm">workflow()</a>
            <a href="#pricing" className="text-gray-700 hover:text-cyan-600 transition-colors font-mono text-sm">pricing()</a>
            <button 
              onClick={handleLogin}
              className="text-gray-700 hover:text-cyan-600 transition-colors font-mono font-medium text-sm"
            >
              {isLoggedIn ? 'dashboard()' : 'login()'}
            </button>
            <a
              href="#demo"
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg hover:shadow-xl transition-all font-mono text-sm"
            >
              demo.run()
            </a>
          </div>

          <div className="md:hidden flex items-center space-x-4">
            <button
              onClick={handleLogin}
              className="text-sm text-gray-700 hover:text-cyan-600 font-mono font-medium"
            >
              {isLoggedIn ? 'dashboard()' : 'login()'}
            </button>
            <button 
              onClick={handleGetStarted}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm rounded-lg hover:shadow-lg transition-all font-mono"
            >
              {isLoggedIn ? 'go()' : 'start()'}
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px),
              linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}></div>
          <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-end mb-4"><LanguageSwitcher className="text-gray-700" /></div>
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center space-x-2 px-4 py-2 glass rounded-full mb-8 border border-emerald-500/20"
            >
              <div className="flex items-center space-x-1 font-mono text-xs">
                <span className="text-emerald-600">const</span>
                <span className="text-gray-700">status</span>
                <span className="text-gray-500">=</span>
                <span className="text-cyan-600">&apos;online&apos;</span>
              </div>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-mono font-bold mb-6 leading-tight">
              <div className="mb-2">
                <span className="text-gray-400 text-3xl md:text-4xl">function </span>
                <span className="gradient-text">
                  masterTechEnglish
                </span>
                <span className="text-gray-400 text-3xl md:text-4xl">()</span>
              </div>
              <div className="font-sans text-4xl md:text-5xl text-gray-800 mt-4">
                {d.hero.tagline}
              </div>
            </h1>

            <div className="bg-gray-900 rounded-xl p-6 max-w-3xl mx-auto mb-12 text-left shadow-2xl border border-gray-800">
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-gray-500 text-xs font-mono">README.md</span>
              </div>
              <pre className="text-sm md:text-base font-mono overflow-x-auto">
                <code>
                  <span className="text-gray-500">// {d.hero.readme1}</span>{'\n'}
                  <span className="text-gray-500">// {d.hero.readme2}</span>{'\n'}
                  {'\n'}
                  <span className="text-purple-400">import</span> <span className="text-blue-400">{'{'}</span> <span className="text-emerald-400">AI, Voice, RealScenarios</span> <span className="text-blue-400">{'}'}</span> <span className="text-purple-400">from</span> <span className="text-yellow-300">&apos;speeck.ai&apos;</span><span className="text-gray-400">;</span>{'\n'}
                  {'\n'}
                  <span className="text-cyan-400">speeck</span><span className="text-gray-400">.</span><span className="text-emerald-400">train</span><span className="text-gray-400">()</span>{'\n'}
                  <span className="text-gray-400">  .</span><span className="text-emerald-400">simulate</span><span className="text-gray-400">(</span><span className="text-yellow-300">&apos;database_crash&apos;</span><span className="text-gray-400">)</span>{'\n'}
                  <span className="text-gray-400">  .</span><span className="text-emerald-400">practice</span><span className="text-gray-400">(</span><span className="text-yellow-300">&apos;voice&apos;</span><span className="text-gray-400">)</span>{'\n'}
                  <span className="text-gray-400">  .</span><span className="text-emerald-400">master</span><span className="text-gray-400">(</span><span className="text-yellow-300">&apos;technical_english&apos;</span><span className="text-gray-400">);</span>
                </code>
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/auth/signup"
                className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white text-lg font-mono font-semibold rounded-xl hover:shadow-2xl transition-all hover:scale-105 relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center">
                  <span className="mr-2">&gt;</span> start_training()
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 glass border-2 border-gray-300 text-gray-800 text-lg font-mono font-semibold rounded-xl hover:border-cyan-500 transition-all hover:shadow-lg"
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2 text-cyan-600">▶</span> demo.run()
                </span>
              </a>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm font-mono"
            >
              <div className="flex items-center space-x-2">
                <span className="text-emerald-600">●</span>
                <span className="text-gray-600">{d.hero.badge1}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-cyan-600">●</span>
                <span className="text-gray-600">{d.hero.badge2}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">●</span>
                <span className="text-gray-600">{d.hero.badge3}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Demo video Section */}
      <section id="demo" className="py-20 px-6 bg-white/50 scroll-mt-24">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-mono mb-3">
            <span className="text-gray-400">// </span><span className="gradient-text">demo.run()</span>
          </h2>
          <p className="text-gray-600 font-mono text-sm mb-8">
            <span className="text-gray-400">// </span>una práctica real, de principio a fin
          </p>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50 glass">
            <video className="w-full block" controls playsInline preload="metadata" poster="/demo/demo-poster.jpg">
              <source src="/demo/demo-narrated.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="mt-8">
            <Link
              href="/demo"
              className="inline-block px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white text-lg font-mono font-semibold rounded-xl hover:shadow-xl transition-all"
            >
              <span className="mr-2">&gt;</span> try_it_live()
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-end mb-4"><LanguageSwitcher className="text-gray-700" /></div>
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="font-mono text-sm text-gray-500 mb-2">// core.features</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {d.features.titlePre} <span className="gradient-text font-mono">{d.features.titleHi}</span>
            </h2>
            <p className="text-xl text-gray-600 font-mono text-sm">
              <span className="text-gray-400">practice</span>(<span className="text-emerald-600">&apos;scenarios_you_will_face&apos;</span>)
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {d.features.items.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-8 hover:shadow-2xl transition-all hover:-translate-y-1 border border-gray-200/50"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 font-mono text-gray-800">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 bg-white/50">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="font-mono text-sm text-gray-500 mb-2">// workflow.steps</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {d.steps.titlePre} <span className="gradient-text font-mono">{d.steps.titleHi}</span>
            </h2>
          </motion.div>

          <div className="space-y-12">
            {d.steps.items.map((step, index) => (
              <motion.div
                key={index}
                initial={{ x: index % 2 === 0 ? -30 : 30, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="flex items-center gap-8"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-white text-2xl font-mono font-bold shadow-xl">
                  {index + 1}
                </div>
                <div className="flex-1 glass rounded-xl p-6 border border-gray-200/50">
                  <h3 className="text-2xl font-bold mb-2 font-mono text-gray-800">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-end mb-4"><LanguageSwitcher className="text-gray-700" /></div>
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="font-mono text-sm text-gray-500 mb-2">// pricing.plans</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {d.pricing.titlePre} <span className="gradient-text font-mono">{d.pricing.titleHi}</span>
            </h2>
            <p className="text-xl text-gray-600 font-mono text-sm">
              <span className="text-gray-400">choose</span>(<span className="text-emerald-600">&apos;your_plan&apos;</span>)
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {d.pricing.plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`glass rounded-2xl p-8 ${
                  PLAN_META[index].popular 
                    ? 'ring-2 ring-cyan-500 shadow-2xl scale-105' 
                    : 'border border-gray-200/50'
                }`}
              >
                {PLAN_META[index].popular && (
                  <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-mono font-bold px-4 py-1 rounded-full inline-block mb-4">
                    {d.pricing.popular}
                  </div>
                )}
                
                <h3 className="text-2xl font-bold mb-2 font-mono">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold font-mono">${PLAN_META[index].price}</span>
                  {PLAN_META[index].price > 0 && <span className="text-gray-600 font-mono text-sm">{d.pricing.perMo}</span>}
                </div>

                <Link
                  href="/auth/signup"
                  className={`block w-full text-center py-3 rounded-xl font-mono font-semibold transition-all mb-6 ${
                    PLAN_META[index].popular
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-xl'
                      : 'glass border-2 border-gray-300 hover:border-cyan-500'
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-sm">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-lg flex items-center justify-center font-mono text-white font-bold text-sm">
                &lt;/&gt;
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-mono font-bold gradient-text">SPEECK.AI</span>
                <span className="text-xs font-mono text-gray-500">// code your communication</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-mono">
              <a href="#features" className="text-gray-600 hover:text-cyan-600">features()</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-cyan-600">workflow()</a>
              <a href="#pricing" className="text-gray-600 hover:text-cyan-600">pricing()</a>
              <Link href="/auth/login" className="text-gray-600 hover:text-cyan-600">login()</Link>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-gray-600 font-mono text-sm">
              © 2025 SPEECK.AI • <span className="text-gray-400">// {d.footer.tagline}</span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
