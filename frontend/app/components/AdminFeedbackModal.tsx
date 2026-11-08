'use client';

// 管理者用：お問い合わせの一覧とステータス管理
import { useCallback, useEffect, useState } from 'react';
import { FEEDBACK_CATEGORY_LABELS } from './FeedbackModal';

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
}

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
  const [filter, setFilter] = useState<Status | 'all'>('all');
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

  const update = async (id: string, fields: { status?: Status; adminNote?: string }) => {
    setBusyId(id);
    setError(null);
    try {
      const data = await adminRequest({ action: 'update', id, ...fields });
      replaceItem(data.item);
    } catch (e) {
      setError((e as Error).message);
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
  const shown = (items || []).filter((i) => filter === 'all' || i.status === filter);

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
          {(['all', 'new', 'in_progress', 'resolved', 'wontfix'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-full border font-semibold ${filter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {s === 'all' ? `すべて（${items?.length ?? 0}）` : `${STATUS_LABELS[s]}（${counts[s] || 0}）`}
            </button>
          ))}
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
                <button type="button" disabled={busyId === item.id} onClick={() => void remove(item.id)} className="px-2.5 py-1 text-rose-700 text-xs disabled:opacity-60">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
