'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Features data
const features = [
  {
    icon: '🎙',
    title: 'Voice-First Practice',
    description: 'Practice speaking with AI that responds naturally. Build confidence in real conversations, not textbooks.'
  },
  {
    icon: '🔥',
    title: 'Real Production Scenarios',
    description: 'Database crashes, network outages, deployment failures—practice the incidents you will actually face.'
  },
  {
    icon: '⚡',
    title: 'Instant Feedback',
    description: 'Get real-time corrections on pronunciation, technical vocabulary, and communication clarity.'
  },
  {
    icon: '🎯',
    title: 'Role-Based Training',
    description: 'Tailored scenarios for DBAs, DevOps, SREs, and Backend Engineers. Practice your specific domain.'
  },
  {
    icon: '📊',
    title: 'Progress Tracking',
    description: 'See your improvement over time with detailed analytics on fluency, vocabulary, and response speed.'
  },
  {
    icon: '🤖',
    title: 'Claude Sonnet 4 Powered',
    description: 'Powered by the most advanced AI to simulate realistic technical conversations and emergencies.'
  }
];

// How it works steps
const steps = [
  {
    title: 'Choose Your Scenario',
    description: 'Select from database failures, network issues, deployment problems, or custom incidents based on your role.'
  },
  {
    title: 'Start Conversation',
    description: 'Speak with AI characters (PMs, engineers, customers) who react realistically to your responses.'
  },
  {
    title: 'Get Feedback & Improve',
    description: 'Receive instant corrections and suggestions. Review transcripts and track your progress over time.'
  }
];

// Pricing plans
const pricingPlans = [
  {
    name: 'Starter',
    price: 0,
    cta: 'Start Free',
    popular: false,
    features: [
      '3 scenarios per month',
      'Basic feedback',
      'Progress tracking',
      'Community support'
    ]
  },
  {
    name: 'Pro',
    price: 12,
    cta: 'Go Pro',
    popular: true,
    features: [
      'Unlimited scenarios',
      'Advanced AI feedback',
      'Custom scenarios',
      'Voice analytics',
      'Priority support',
      'Export transcripts'
    ]
  },
  {
    name: 'Team',
    price: 299,
    cta: 'Contact Sales',
    popular: false,
    features: [
      'Everything in Pro',
      'Team dashboard',
      'SSO integration',
      'Custom integrations',
      'Dedicated support',
      'Up to 50 users'
    ]
  }
];

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
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
            <Link 
              href="/demo"
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg hover:shadow-xl transition-all font-mono text-sm"
            >
              demo.run()
            </Link>
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
                Code Your Communication
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
                  <span className="text-gray-500">// Practice technical English through</span>{'\n'}
                  <span className="text-gray-500">// real production incident simulations</span>{'\n'}
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
              <Link 
                href="/demo"
                className="w-full sm:w-auto px-8 py-4 glass border-2 border-gray-300 text-gray-800 text-lg font-mono font-semibold rounded-xl hover:border-cyan-500 transition-all hover:shadow-lg"
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2 text-cyan-600">▶</span> demo.run()
                </span>
              </Link>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm font-mono"
            >
              <div className="flex items-center space-x-2">
                <span className="text-emerald-600">●</span>
                <span className="text-gray-600">Claude Sonnet 4 powered</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-cyan-600">●</span>
                <span className="text-gray-600">Real-time voice feedback</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">●</span>
                <span className="text-gray-600">24/7 incident scenarios</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="font-mono text-sm text-gray-500 mb-2">// core.features</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Engineers Choose <span className="gradient-text font-mono">SPEECK</span>
            </h2>
            <p className="text-xl text-gray-600 font-mono text-sm">
              <span className="text-gray-400">practice</span>(<span className="text-emerald-600">&apos;scenarios_you_will_face&apos;</span>)
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
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
              Get Fluent in <span className="gradient-text font-mono">3 Steps</span>
            </h2>
          </motion.div>

          <div className="space-y-12">
            {steps.map((step, index) => (
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
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="font-mono text-sm text-gray-500 mb-2">// pricing.plans</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent <span className="gradient-text font-mono">Pricing</span>
            </h2>
            <p className="text-xl text-gray-600 font-mono text-sm">
              <span className="text-gray-400">choose</span>(<span className="text-emerald-600">&apos;your_plan&apos;</span>)
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`glass rounded-2xl p-8 ${
                  plan.popular 
                    ? 'ring-2 ring-cyan-500 shadow-2xl scale-105' 
                    : 'border border-gray-200/50'
                }`}
              >
                {plan.popular && (
                  <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-mono font-bold px-4 py-1 rounded-full inline-block mb-4">
                    POPULAR
                  </div>
                )}
                
                <h3 className="text-2xl font-bold mb-2 font-mono">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold font-mono">${plan.price}</span>
                  {plan.price > 0 && <span className="text-gray-600 font-mono text-sm">/mo</span>}
                </div>

                <Link
                  href="/auth/signup"
                  className={`block w-full text-center py-3 rounded-xl font-mono font-semibold transition-all mb-6 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-xl'
                      : 'glass border-2 border-gray-300 hover:border-cyan-500'
                  }`}
                >
                  {plan.cta}()
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
              © 2025 SPEECK.AI • <span className="text-gray-400">// Built for engineers, by engineers</span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
