import type { MetadataRoute } from 'next';
import { siteUrl } from './siteConfig';

// 一般のページはクロールを許可し、APIと管理者用のパスは除外する
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin']
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl()
  };
}
