import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viola.app';
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/welcome`, lastModified: now, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/early`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/plus`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
