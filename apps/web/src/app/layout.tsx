import type { Metadata, Viewport } from 'next';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Viola — post your fit, and voilà',
    template: '%s · Viola',
  },
  description:
    'Post your fit and Viola names every piece, scores the look, and shows you where to buy it.',
  openGraph: {
    type: 'website',
    siteName: 'Viola',
    title: 'Viola — post your fit, and voilà',
    description: 'Every piece identified, scored, and shoppable.',
  },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Viola' },
};

export const viewport: Viewport = {
  themeColor: '#0B0A0F',
  width: 'device-width',
  initialScale: 1,
  // The ICP is overwhelmingly on a phone, and a share recipient often lands
  // here from a message thread. Cover the safe area properly.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
