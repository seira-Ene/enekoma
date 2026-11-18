'use client';

// AIの回答カードの本文。結論と主な箇条書きは常に表示し、補足・一覧は「▶ 詳細・補足を見る（全○件）」で開閉する。
// すっきり表示では補足を閉じた状態、すべて表示では開いた状態で始める。
import { useState } from 'react';
import { parseReply, splitBold, type DisplayMode, type ReplyItem } from '@/app/data/replyFormat';

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

function Items({ items }: { items: ReplyItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-1.5">
          <span aria-hidden="true" className="text-slate-400 shrink-0">
            ・
          </span>
          <span className="min-w-0">
            {item.label && <strong className="font-semibold text-slate-900">{item.label}：</strong>}
            <Inline text={item.text} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ChatReply({ text, mode, id }: { text: string; mode: DisplayMode; id: string }) {
  const { lead, main, details } = parseReply(text, mode);
  // 表示モードを切り替えたら開閉の初期状態も変える（key で作り直す）
  const [open, setOpen] = useState(mode === 'detailed');
  const panelId = `reply-details-${id}`;

  return (
    <div className="text-sm leading-relaxed break-words space-y-2" data-chat-reply>
      {lead.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap" data-reply-lead>
          <Inline text={p} />
        </p>
      ))}
      {main.length > 0 && (
        <div data-reply-main>
          <Items items={main} />
        </div>
      )}
      {details.length > 0 && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            data-reply-toggle
            className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            <span aria-hidden="true">{open ? '▼' : '▶'}</span>
            <span>{open ? '詳細・補足を閉じる' : `詳細・補足を見る（全${details.length}件）`}</span>
          </button>
          {open && (
            <div id={panelId} className="mt-2 pl-2 border-l-2 border-slate-200 text-slate-700" data-reply-details>
              <Items items={details} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
