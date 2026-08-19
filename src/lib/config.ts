/**
 * Application Configuration
 * Centralized config file for environment-specific settings
 */

// Get base URL from environment or fallback to localhost
const getBaseUrl = () => {
  // Priority 1: Custom environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Priority 2: Vercel deployment
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // Priority 3: Browser window location (client-side)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Priority 4: Default to localhost
  return 'http://localhost:3000';
};

export const config = {
  // App Info
  app: {
    name: 'SPEECK.AI',
    description: 'Master Technical English for Production Incidents - Code Your Communication',
    url: getBaseUrl(),
  },

  // URLs
  urls: {
    base: getBaseUrl(),
    dashboard: `${getBaseUrl()}/dashboard`,
    invite: (token: string) => `${getBaseUrl()}/invite/${token}`,
    callback: `${getBaseUrl()}/auth/callback`,
  },

  // Supabase
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },

  // AI Services
  ai: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
    },
  },

  // Email Service
  email: {
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
    },
    from: process.env.EMAIL_FROM || 'SPEECK.AI <noreply@speeck.ai>',
    
    // Testing mode: if set, ALL emails go to this address
    // Leave empty for production (sends to actual recipients)
    testingEmail: process.env.EMAIL_TESTING_MODE || '',
  },

  // Feature Flags
  features: {
    emailInvites: !!process.env.RESEND_API_KEY || !!process.env.SENDGRID_API_KEY,
    oauth: true,
    voice: !!process.env.ELEVENLABS_API_KEY,
  },

  // Environment
  env: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isStaging: process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview',
  },
};

// Helper to get full URL
export const getUrl = (path: string = '') => {
  const baseUrl = config.urls.base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

// Helper to get invite URL
export const getInviteUrl = (token: string) => {
  return config.urls.invite(token);
};

export default config;
