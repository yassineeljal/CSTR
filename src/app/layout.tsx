import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const TITLE = 'CSTR Digital Twin — simulateur 3D d’emballement thermique';
const DESCRIPTION =
  'Jumeau numérique 3D temps réel d’un réacteur agité continu (CSTR) exothermique : emballement thermique (loi d’Arrhenius), régulation PID, soupape de sécurité et quench d’urgence, avec mode inspection académique.';

/** URL publique (aperçus de partage). Définir NEXT_PUBLIC_SITE_URL en production. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s' },
  description: DESCRIPTION,
  applicationName: 'CSTR Digital Twin',
  keywords: [
    'CSTR',
    'génie chimique',
    'emballement thermique',
    'jumeau numérique',
    'simulation',
    'PID',
    'Three.js',
    'WebGL',
  ],
  authors: [{ name: 'Polytechnique Montréal × ÉTS' }],
  openGraph: {
    type: 'website',
    locale: 'fr_CA',
    siteName: 'CSTR Digital Twin',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: '#0d1013',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
