'use client';

// 表示する情報量の切り替え（すっきり / すべて）。チャットの下と基本設定の両方に置く
import { DISPLAY_MODE_LABEL, type DisplayMode } from '@/app/data/replyFormat';

const DESCRIPTION: Record<DisplayMode, string> = {
  simple: '要点だけ。補足は閉じて表示',
  detailed: '補足・関連情報まで開いて表示'
};

export default function DisplayModeToggle({
  mode,
  onChange,
  showDescription = false,
  id = 'display-mode'
}: {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  showDescription?: boolean;
  id?: string;
}) {
  return (
    <div role="radiogroup" aria-label="表示する情報量" data-display-mode-toggle={id} className={showDescription ? 'grid grid-cols-2 gap-2' : 'inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 shrink-0'}>
      {(['simple', 'detailed'] as DisplayMode[]).map((option) => {
        const selected = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            data-display-mode={option}
            onClick={() => onChange(option)}
            className={
              showDescription
                ? `p-2 rounded-lg border text-left transition ${selected ? 'border-slate-800 ring-2 ring-slate-800/20 bg-white' : 'border-slate-200 bg-white hover:bg-slate-100'}`
                : `min-h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition ${selected ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`
            }
          >
            {showDescription ? (
              <>
                <span className="flex items-center gap-1 text-xs font-bold text-slate-900">
                  {selected && <span aria-hidden="true">✓</span>}
                  {DISPLAY_MODE_LABEL[option]}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{DESCRIPTION[option]}</span>
              </>
            ) : (
              DISPLAY_MODE_LABEL[option]
            )}
          </button>
        );
      })}
    </div>
  );
}
