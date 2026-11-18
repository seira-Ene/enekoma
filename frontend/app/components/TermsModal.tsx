'use client';

// 利用規約の全文。新規学生登録の「利用規約」から開く。「同意して閉じる」でチェックを入れる
import { useEffect, useRef } from 'react';
import { TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from '@/app/data/terms';

export default function TermsModal({ onClose, onAgree }: { onClose: () => void; onAgree: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        data-terms-modal
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[88vh] flex flex-col border border-slate-200"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 id="terms-title" className="text-sm font-bold text-slate-900">
              {TERMS_TITLE}
            </h3>
            <p className="text-[11px] text-slate-500">制定日：{TERMS_VERSION.replace(/-/g, '/')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="利用規約を閉じる"
            className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto text-xs text-slate-700 space-y-3 leading-relaxed" data-terms-body>
          {TERMS_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h4 className="font-bold text-slate-900 mb-1">{section.heading}</h4>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span aria-hidden="true" className="text-slate-400 shrink-0">
                      ・
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 px-4 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50">
            閉じる
          </button>
          <button
            type="button"
            onClick={onAgree}
            data-terms-agree
            className="min-h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            同意して閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
