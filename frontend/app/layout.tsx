import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, M_PLUS_Rounded_1c, Zen_Kaku_Gothic_New } from "next/font/google";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "./data/themes";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, siteUrl } from "./siteConfig";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// テーマ用の日本語フォント。preload しないので、そのテーマを選んだ人の端末だけが読み込む
const roundedFont = M_PLUS_Rounded_1c({
  variable: "--font-rounded",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

const sharpFont = Zen_Kaku_Gothic_New({
  variable: "--font-sharp",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

// 検索結果とSNSシェアに出す情報。og:image は app/opengraph-image.png から自動で入る
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: `%s｜${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EneKoma",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme は描画前のスクリプトが書き換えるので、サーバーの値との違いを警告しない
    <html
      lang="ja"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${roundedFont.variable} ${sharpFont.variable} h-full antialiased`}
    >
      <head>
        {/* 保存したテーマを最初の描画より前に適用する（再読み込み時に一瞬デフォルト色が出ないように） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 検索エンジン向けの構造化データ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_NAME,
              url: siteUrl(),
              description: SITE_DESCRIPTION,
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              inLanguage: "ja",
              offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
              audience: { "@type": "EducationalAudience", educationalRole: "student" },
            }),
          }}
        />
      </head>
      <body className="h-full flex flex-col overscroll-none select-text">{children}</body>
    </html>
  );
}
