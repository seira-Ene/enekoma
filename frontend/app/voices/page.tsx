// ユーザーの声・レビュー一覧（管理者が公開を許可したものだけ。投稿者の情報は出さない）
import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicFaq, listPublicFeedback, PublicFeedback } from '../api/feedback/feedbackStore';
import FaqSearch from '../components/FaqSearch';
import type { PublicFaq } from '../data/faqSearch';

// 公開の切り替えをすぐに反映するため、毎回読み込む
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'よくある質問・ユーザーの声',
  description: '日本大学文理学部の履修アシスタント「エネコマ」のよくある質問・不具合の対処法と、学生のレビュー・ご意見。履修管理やGPA計算、空き教室検索の使い方や困ったときの解決手順を検索できます。',
  alternates: { canonical: '/voices' },
  openGraph: { url: '/voices', title: 'よくある質問・ユーザーの声｜エネコマ（EneKoma）' }
};

const CATEGORY_LABELS: Record<PublicFeedback['category'], string> = {
  review: '⭐ レビュー',
  opinion: '💡 ご意見',
  question: '❓ 質問',
  bug: '🐛 不具合報告'
};

async function loadFaq(): Promise<PublicFaq[]> {
  try {
    return await listPublicFaq();
  } catch {
    return [];
  }
}

async function loadVoices(): Promise<PublicFeedback[]> {
  try {
    return await listPublicFeedback();
  } catch {
    // 保存先に接続できないときは、空の一覧を出す
    return [];
  }
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`5段階中${value}`}>
      {'★'.repeat(value)}
      <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

// JSON-LD の中の「<」を Unicode エスケープにして、本文に </script> が書かれても script を閉じさせない
const SCRIPT_LT = String.fromCharCode(0x5c) + 'u003c';

export default async function VoicesPage() {
  const [voices, faqs] = await Promise.all([loadVoices(), loadFaq()]);
  // 検索エンジン向けのFAQの構造化データ
  const faqJsonLd = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.slice(0, 30).map((f) => ({ '@type': 'Question', name: f.title, acceptedAnswer: { '@type': 'Answer', text: f.answer } }))
      }
    : null;
  const ratings = voices.map((v) => v.rating).filter((r): r is number => typeof r === 'number');
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return (
    <main className="min-h-full bg-slate-50 text-slate-800 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, SCRIPT_LT) }} />}
        <nav className="text-xs">
          <Link href="/" className="text-slate-600 underline underline-offset-2 hover:text-slate-900">← エネコマに戻る</Link>
        </nav>

        <header className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">よくある質問・ユーザーの声</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            日本大学文理学部の学生のための履修アシスタント「エネコマ」に寄せられた声です。運営が確認したものだけを掲載し、投稿者の名前やメールアドレスは表示していません。
          </p>
          {average !== null && (
            <p className="text-sm font-semibold text-slate-900">
              平均評価 <Stars value={Math.round(average)} /> {average.toFixed(1)}
              <span className="ml-1 text-xs font-normal text-slate-500">（レビュー{ratings.length}件）</span>
            </p>
          )}
          <Link href="/?feedback=1" className="inline-block mt-1 px-3 py-2 bg-slate-900 text-white rounded-md text-xs font-medium">
            💬 声を送る
          </Link>
        </header>

        <FaqSearch items={faqs} />

        <h2 className="pt-2 text-lg font-bold text-slate-900">ユーザーの声・レビュー</h2>
        {voices.length === 0 ? (
          <p className="text-sm text-slate-500">まだ掲載している声はありません。</p>
        ) : (
          <ul className="space-y-3">
            {voices.map((v) => (
              <li key={v.id} className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-bold text-slate-900">{CATEGORY_LABELS[v.category]}</span>
                  {v.rating ? <Stars value={v.rating} /> : null}
                  <span className="text-slate-500">匿名ユーザー・{v.date.replace(/-/g, '/')}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{v.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
