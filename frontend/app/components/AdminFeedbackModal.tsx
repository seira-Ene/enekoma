'use client';

// 管理者用：お問い合わせの一覧とステータス管理
import { useCallback, useEffect, useState } from 'react';
import { FEEDBACK_CATEGORY_LABELS } from './FeedbackModal';
import { normalizeForSearch } from '@/app/data/faqSearch';

type Status = 'new' | 'in_progress' | 'resolved' | 'wontfix';
const STATUS_LABELS: Record<Status, string> = { new: '未対応', in_progress: '対応中', resolved: '対応済み', wontfix: '対応不要' };
const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-rose-100 text-rose-800 border-rose-200',
  in_progress: 'bg-amber-100 text-amber-900 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  wontfix: 'bg-slate-100 text-slate-600 border-slate-200'
};

interface Item {
  id: string;
  createdAt: string;
  category: keyof typeof FEEDBACK_CATEGORY_LABELS;
  message: string;
  rating?: number;
  email?: string;
  loginId?: string;
  userAgent?: string;
  status: Status;
  adminNote?: string;
  isPublic?: boolean;
  faqTitle?: string;
  answer?: string;
  isFaq?: boolean;
}

type ItemUpdate = Partial<Pick<Item, 'status' | 'adminNote' | 'isPublic' | 'faqTitle' | 'answer' | 'isFaq'>>;

const adminCode = () => sessionStorage.getItem('enekoma_admin_code') || '';
const jst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);

async function adminRequest(body: object) {
  const res = await fetch('/api/admin/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminCode: adminCode(), ...body }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '処理できませんでした。');
  return data;
}

export default function AdminFeedbackModal({ onClose, onCountChange }: { onClose: () => void; onCountChange?: (newCount: number) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<Status | 'all' | 'public' | 'faq'>('all');
  const [query, setQuery] = useState('');
  // 回答・FAQタイトルの書きかけ
  const [drafts, setDrafts] = useState<Record<string, { faqTitle: string; answer: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminRequest({ action: 'list' });
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // 開いたときに一覧を読み込む（state はデータが届いてから更新する）
  useEffect(() => {
    let alive = true;
    adminRequest({ action: 'list' })
      .then((data) => {
        if (alive) setItems(data.items);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 未対応の件数を管理者バーに伝える
  useEffect(() => {
    if (items) onCountChange?.(items.filter((i) => i.status === 'new').length);
  }, [items, onCountChange]);

  const replaceItem = (item: Item) => setItems((list) => (list || []).map((x) => (x.id === item.id ? item : x)));

  // 成功したら true を返す
  const update = async (id: string, fields: ItemUpdate): Promise<boolean> => {
    setBusyId(id);
    setError(null);
    try {
      const data = await adminRequest({ action: 'update', id, ...fields });
      replaceItem(data.item);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('このお問い合わせを削除しますか？元に戻せません。')) return;
    setBusyId(id);
    try {
      await adminRequest({ action: 'delete', id });
      setItems((list) => (list || []).filter((x) => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const counts = (items || []).reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {});
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  const shown = (items || [])
    .filter((i) => filter === 'all' || (filter === 'public' ? i.isPublic : filter === 'faq' ? i.isFaq : i.status === filter))
    .filter((i) => {
      if (terms.length === 0) return true;
      const text = normalizeForSearch([i.message, i.faqTitle, i.answer, i.adminNote, i.email, i.loginId].filter(Boolean).join('\n'));
      return terms.every((term) => text.includes(term));
    });
  const draftOf = (item: Item) => drafts[item.id] ?? { faqTitle: item.faqTitle ?? '', answer: item.answer ?? '' };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-feedback-title">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[88dvh] flex flex-col border border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-2 p-4 border-b border-slate-100">
          <div className="min-w-0 flex-1 basis-56">
            <h3 id="admin-feedback-title" className="font-bold text-slate-900 text-sm">💬 お問い合わせ管理</h3>
            <p className="text-[11px] text-slate-500">新しい順に最大500件。ログインIDは送信者の申告です。</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <button type="button" onClick={() => void load()} className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">再読み込み</button>
            <button type="button" onClick={onClose} className="px-2.5 py-1 text-xs bg-slate-900 text-white rounded">閉じる</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 pt-3 text-[11px]">
          {(['all', 'new', 'in_progress', 'resolved', 'wontfix', 'public', 'faq'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-full border font-semibold ${filter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {s === 'all'
                ? `すべて（${items?.length ?? 0}）`
                : s === 'public'
                  ? `公開中（${(items || []).filter((i) => i.isPublic).length}）`
                  : s === 'faq'
                    ? `FAQ公開中（${(items || []).filter((i) => i.isFaq).length}）`
                    : `${STATUS_LABELS[s]}（${counts[s] || 0}）`}
            </button>
          ))}
        </div>
        <div className="px-4 pt-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="本文・回答・メモ・メールアドレスで検索"
            aria-label="お問い合わせを検索"
            className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
          />
        </div>

        <div className="p-4 overflow-y-auto space-y-2.5 text-xs">
          {error && <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
          {items === null && !error && <p className="text-slate-500">読み込み中…</p>}
          {items && shown.length === 0 && <p className="text-slate-500">該当するお問い合わせはありません。</p>}
          {shown.map((item) => (
            <div key={item.id} data-feedback-id={item.id} className="p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                <span className="font-bold text-slate-900">{FEEDBACK_CATEGORY_LABELS[item.category]}</span>
                {item.rating ? <span className="text-amber-500" aria-label={`${item.rating}つ星`}>{'★'.repeat(item.rating)}<span className="text-slate-300">{'★'.repeat(5 - item.rating)}</span></span> : null}
                <span className="text-slate-500">{jst(item.createdAt)}</span>
                {item.isPublic && <span className="px-2 py-0.5 rounded border text-[10px] font-bold bg-sky-100 text-sky-800 border-sky-200">公開中</span>}
                {item.isFaq && <span className="px-2 py-0.5 rounded border text-[10px] font-bold bg-violet-100 text-violet-800 border-violet-200">FAQ公開中</span>}
              </div>
              <p className="whitespace-pre-wrap break-words text-slate-800 leading-relaxed">{item.message}</p>
              <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                {item.email && <a href={`mailto:${item.email}`} className="underline">{item.email}</a>}
                {item.loginId && <span>ログインID：{item.loginId}</span>}
                {item.userAgent && <span className="break-all">端末：{item.userAgent}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={item.status}
                  disabled={busyId === item.id}
                  onChange={(e) => void update(item.id, { status: e.target.value as Status })}
                  aria-label="ステータス"
                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                >
                  {(Object.keys(STATUS_LABELS) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <input
                  value={notes[item.id] ?? item.adminNote ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                  placeholder="管理メモ（利用者には表示されません）"
                  aria-label="管理メモ"
                  className="flex-1 min-w-40 px-2 py-1 border border-slate-300 rounded text-xs"
                />
                <button type="button" disabled={busyId === item.id} onClick={() => void update(item.id, { adminNote: notes[item.id] ?? item.adminNote ?? '' })} className="px-2.5 py-1 border border-slate-300 rounded text-xs disabled:opacity-60">メモ保存</button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!item.isPublic}
                  disabled={busyId === item.id}
                  onClick={() => {
                    if (!item.isPublic && !confirm('「ユーザーの声」に匿名で公開します。本文に個人を特定できる内容がないか確認しましたか？')) return;
                    void update(item.id, { isPublic: !item.isPublic });
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border disabled:opacity-60 ${item.isPublic ? 'bg-white text-slate-700 border-slate-300' : 'bg-sky-600 text-white border-sky-600'}`}
                >
                  {item.isPublic ? '非公開にする' : '公開する'}
                </button>
                <button type="button" disabled={busyId === item.id} onClick={() => void remove(item.id)} className="px-2.5 py-1 text-rose-700 text-xs disabled:opacity-60">削除</button>
              </div>

              {/* 回答・解決手順とFAQの公開 */}
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-1.5" data-faq-editor>
                <input
                  value={draftOf(item).faqTitle}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draftOf(item), faqTitle: e.target.value } }))}
                  placeholder="FAQのタイトル（例: 空き教室が表示されないとき）"
                  aria-label="FAQのタイトル"
                  maxLength={100}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                />
                <textarea
                  value={draftOf(item).answer}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draftOf(item), answer: e.target.value } }))}
                  placeholder="回答・解決手順（FAQとして公開すると利用者に表示されます）"
                  aria-label="回答・解決手順"
                  rows={3}
                  maxLength={4000}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={async () => {
                      // 保存できたときだけ書きかけを消す
                      if (await update(item.id, draftOf(item))) setDrafts((d) => { const next = { ...d }; delete next[item.id]; return next; });
                    }}
                    className="px-2.5 py-1 border border-slate-300 rounded text-xs bg-white disabled:opacity-60"
                  >
                    回答を保存
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!item.isFaq}
                    disabled={busyId === item.id || (!item.isFaq && !item.answer?.trim())}
                    title={!item.isFaq && !item.answer?.trim() ? '回答を保存してから公開できます' : undefined}
                    onClick={() => {
                      if (!item.isFaq && !confirm('FAQとして公開し、利用者の検索結果に表示します。質問文は個人情報を伏せて表示されます。よろしいですか？')) return;
                      void update(item.id, { isFaq: !item.isFaq });
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border disabled:opacity-50 ${item.isFaq ? 'bg-white text-slate-700 border-slate-300' : 'bg-violet-600 text-white border-violet-600'}`}
                  >
                    {item.isFaq ? 'FAQから外す' : 'FAQとして公開（検索対象にする）'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
