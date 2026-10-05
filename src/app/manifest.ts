import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'העסק של נופר',
    short_name: 'נופר',
    description: 'ניהול העסק בפשטות',
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7f4',
    theme_color: '#28735c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
