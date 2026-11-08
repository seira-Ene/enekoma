'use client';

// よくある質問・不具合対処法の検索と絞り込み（/voices）
import { useMemo, useState } from 'react';
import { FAQ_CATEGORY_LABELS, FaqCategory, PublicFaq, searchFaqByKeyword } from '@/app/data/faqSearch';

const FILTERS: (FaqCategory | 'all')[] = ['all', 'bug', 'question', 'opinion'];

export default function FaqSearch({ items }: { items: PublicFaq[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');
  const [resolvedOnly, setResolvedOnly] = useState(false);
  const results = useMemo(() => searchFaqByKeyword(items, query, { category, resolvedOnly }), [items, query, category, resolvedOnly]);

  return (
    <section aria-labelledby="faq-title" className="space-y-3">
      <h2 id="faq-title" className="text-lg font-bold text-slate-900">よくある質問・不具合の対処法</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワードで検索（例: 空き教室 表示されない）"
        aria-label="よくある質問を検索"
        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {FILTERS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 rounded-full border font-semibold ${category === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {c === 'all' ? 'すべて' : FAQ_CATEGORY_LABELS[c]}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-slate-700">
          <input type="checkbox" checked={resolvedOnly} onChange={(e) => setResolvedOnly(e.target.checked)} />
          解決済みのみ
        </label>
      </div>

      <p className="text-[11px] text-slate-500" aria-live="polite">
        {items.length === 0 ? 'まだ掲載しているFAQはありません。' : `${results.length}件${query || category !== 'all' || resolvedOnly ? '（全' + items.length + '件中）' : ''}`}
      </p>

      <ul className="space-y-2">
        {results.map((f) => (
          <li key={f.id} className="bg-white rounded-xl border border-slate-200">
            <details className="group">
              <summary className="cursor-pointer list-none p-3.5 flex items-start gap-2">
                <span className="text-slate-400 group-open:rotate-90 transition-transform" aria-hidden="true">▶</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{f.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="text-slate-600">{FAQ_CATEGORY_LABELS[f.category]}</span>
                    {f.resolved && <span className="px-1.5 rounded bg-emerald-100 text-emerald-800 font-semibold">解決済み</span>}
                  </span>
                </span>
              </summary>
              <div className="px-3.5 pb-3.5 space-y-2 text-sm">
                <p className="text-xs text-slate-500 whitespace-pre-wrap break-words">寄せられた内容：{f.question}</p>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold text-emerald-700 mb-1">運営からの回答・解決手順</p>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{f.answer}</p>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
