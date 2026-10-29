import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { COULEUR_BARRE } from '@/lib/theme';
import { themeCourant } from '@/lib/theme-serveur';
import './globals.css';

// Polices embarquées : aucun téléchargement, même sur le réseau interne sans Internet.
const geistSans = localFont({
  src: './fonts/geist-latin.woff2',
  weight: '100 900',
  variable: '--font-geist-sans',
});

const geistMono = localFont({
  src: './fonts/geist-mono-latin.woff2',
  weight: '100 900',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Demandes de visa · DGRECM',
  description:
    "Préparation et suivi des demandes de visa d'études des militaires boursiers",
  // Application interne : pas d'indexation par les moteurs de recherche.
  robots: { index: false, follow: false },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await themeCourant();
  return {
    themeColor: COULEUR_BARRE[theme],
    colorScheme: theme === 'sombre' ? 'dark' : 'light',
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      data-theme={await themeCourant()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
