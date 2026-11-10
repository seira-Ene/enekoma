'use client';

// 「💡 いつもの質問」：よく送る質問のチップ。タップで送信、右端の✕で履歴から消す。1件もなければ何も出さない
import type { FrequentQuestion } from '@/app/data/frequentQuestions';

interface Props {
  items: FrequentQuestion[];
  disabled?: boolean;
  onSelect: (text: string) => void;
  onRemove: (text: string) => void;
}

export default function FrequentQuestions({ items, disabled, onSelect, onRemove }: Props) {
  if (items.length === 0) return null;
  return (
    <section aria-label="いつもの質問" data-frequent-questions className="flex items-center gap-1.5 pb-1.5 min-w-0">
      <span className="text-[11px] font-medium text-indigo-700 whitespace-nowrap shrink-0">💡 いつもの質問</span>
      <ul className="flex items-center gap-1.5 overflow-x-auto no-scrollbar overscroll-x-contain min-w-0">
        {items.map((q) => (
          <li
            key={q.text}
            data-frequent-chip={q.text}
            className="flex items-center shrink-0 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-900 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => onSelect(q.text)}
              disabled={disabled}
              title={`${q.text}（${q.count}回）`}
              className="text-xs pl-2.5 pr-1 py-1 max-w-[13rem] truncate rounded-l-full hover:bg-indigo-100 disabled:opacity-60"
            >
              {q.text}
            </button>
            <button
              type="button"
              onClick={() => onRemove(q.text)}
              aria-label={`「${q.text}」を履歴から削除`}
              data-frequent-remove
              className="w-6 h-6 mr-0.5 flex items-center justify-center rounded-full text-[11px] text-indigo-700 hover:bg-indigo-200"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
