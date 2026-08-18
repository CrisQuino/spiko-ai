import type { MetadataRoute } from 'next';

// Served by Next at /manifest.webmanifest — makes SPEECK.AI installable.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SPEECK.AI — Code Your Communication',
    short_name: 'SPEECK.AI',
    description: 'AI role-play to practice real work conversations in a second language, with instant CEFR feedback.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1020',
    theme_color: '#0b1020',
    categories: ['education', 'productivity', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
