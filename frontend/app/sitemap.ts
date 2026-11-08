import type { MetadataRoute } from 'next';
import { siteUrl } from './siteConfig';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/voices`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 }
  ];
}
