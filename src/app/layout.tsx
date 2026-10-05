import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'נופר | העסק שלי',
  description: 'לקוחות, אירועים ותשלומים — הכל במקום אחד',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'העסק של נופר' },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f7f4',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
