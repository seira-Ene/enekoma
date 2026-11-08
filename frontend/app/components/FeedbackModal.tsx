'use client';

// 利用者用：お問い合わせ・フィードバックのフォーム
import { useState } from 'react';
import { UNIVERSITY_EMAIL_DOMAIN, checkEmailAddress } from '@/app/data/emailAddress';

export const FEEDBACK_CATEGORY_LABELS = {
  review: 'レビュー',
  opinion: 'ご意見・要望',
  question: '質問',
  bug: '不具合報告'
} as const;
type Category = keyof typeof FEEDBACK_CATEGORY_LABELS;

const PLACEHOLDERS: Record<Category, string> = {
  review: '使ってみた感想を教えてください',
  opinion: 'あったらうれしい機能や、改善してほしい点を教えてください',
  question: '知りたいことを書いてください（返信が必要ならメールアドレスも入れてください）',
  bug: 'どの画面で、何をしたら、どうなったかを書いてください'
};

export default function FeedbackModal({ onClose, loginId, defaultEmail }: { onClose: () => void; loginId?: string; defaultEmail?: string | null }) {
  const [category, setCategory] = useState<Category>('opinion');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(defaultEmail || '');
  const [website, setWebsite] = useState(''); // 自動送信よけ（人には見えない）
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) {
      setError('内容を5文字以上で入力してください。');
      return;
    }
    if (email.trim()) {
      const check = checkEmailAddress(email);
      if (!check.ok) {
        setError(check.message);
        return;
      }
    }
    setSending(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, rating: category === 'review' ? rating : undefined, email: email.trim() || undefined, loginId, website })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || '送信できませんでした。');
        return;
      }
      setDone(true);
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90dvh] flex flex-col border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 id="feedback-title" className="font-bold text-slate-900 text-sm">💬 お問い合わせ・フィードバック</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none" aria-label="閉じる">×</button>
        </div>

        {done ? (
          <div className="p-5 space-y-3 text-sm text-slate-700">
            <p className="font-semibold text-emerald-700">✓ 送信しました。ありがとうございます！</p>
            <p className="text-xs text-slate-500">いただいた内容は運営が確認します。{email.trim() ? '返信が必要な場合は、入力されたメールアドレスに連絡します。' : ''}</p>
            <button type="button" onClick={onClose} className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium">閉じる</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 space-y-3 overflow-y-auto text-xs">
            <div role="radiogroup" aria-label="種類" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(FEEDBACK_CATEGORY_LABELS) as Category[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`py-2 rounded-md border font-semibold transition ${category === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  {FEEDBACK_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            {category === 'review' && (
              <div className="flex items-center gap-1" role="radiogroup" aria-label="評価">
                <span className="text-slate-600 mr-1">評価</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}つ星`} onClick={() => setRating(n)} className={`text-xl leading-none ${n <= rating ? 'text-amber-500' : 'text-slate-300'}`}>
                    ★
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError(null);
              }}
              rows={6}
              maxLength={2000}
              placeholder={PLACEHOLDERS[category]}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
            />
            <div className="text-right text-[10px] text-slate-400 -mt-2">{message.length} / 2000</div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1" htmlFor="feedback-email">返信先のメールアドレス（任意）</label>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`例: xxx@${UNIVERSITY_EMAIL_DOMAIN}`}
                autoComplete="email"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>
            {/* 自動送信よけ。画面には表示しない */}
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

            <p className="text-[10px] text-slate-500 leading-relaxed">成績や時間割などのカルテの内容は送られません。パスワードは書かないでください。</p>
            {error && <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
            <button type="submit" disabled={sending} className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium disabled:opacity-60">
              {sending ? '送信中…' : '送信する'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
