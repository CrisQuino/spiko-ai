import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UiI18nProvider } from "@/lib/ui-i18n";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "SPEECK.AI - Code Your Communication",
  description: "Practice real work conversations in a second language with AI role-play and instant CEFR feedback — tech, finance and more.",
  applicationName: "SPEECK.AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SPEECK.AI", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1020',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <PWARegister />
        <UiI18nProvider>
          {children}
        </UiI18nProvider>
      </body>
    </html>
  );
}
