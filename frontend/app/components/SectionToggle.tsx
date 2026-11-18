'use client';

// 画面上部のブロック（メニュー・空き教室検索・いつもの質問）の開閉。
// 初めは表示モードに合わせる（すっきり＝閉じる、すべて＝開く）。手で開閉したらそれを優先し、表示モードを切り替えたら初めの状態に戻す
import { useState, type ReactNode } from 'react';
import { sectionOpenByDefault, type DisplayMode } from '@/app/data/replyFormat';

export function useSectionOpen(mode: DisplayMode): [boolean, () => void] {
  const [state, setState] = useState<{ mode: DisplayMode; open: boolean }>({ mode, open: sectionOpenByDefault(mode) });
  const open = state.mode === mode ? state.open : sectionOpenByDefault(mode);
  return [open, () => setState({ mode, open: !open })];
}

export default function SectionToggle({
  open,
  onToggle,
  controls,
  section,
  children,
  className = ''
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  section: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      data-section-toggle={section}
      className={`flex items-center gap-1 min-h-9 px-2 rounded-lg text-xs font-bold text-slate-800 whitespace-nowrap shrink-0 hover:bg-slate-200/60 transition ${className}`}
    >
      <span aria-hidden="true" className="text-[10px] text-slate-500 w-3">
        {open ? '▼' : '▶'}
      </span>
      {children}
    </button>
  );
}
