'use client';

// フレンド機能（フレンドコード方式）。フレンドに見せるのは名前と、今の授業（科目名・教室）か空きコマかだけ
import { useCallback, useEffect, useState } from 'react';
import { cardBadges, slotHeading, type FriendCurrentStatus, type FriendSlotStatus, type CampusSlot } from '@/app/data/friendStatus';
import { getSessionToken, saveSessionToken } from '@/app/data/studentAccounts';
import { callAccountApi } from '@/app/data/accountClient';

interface Props {
  loginId: string;
  // サーバーに登録したアカウントか（デモ・端末内だけのアカウントは使えない）
  serverLinked: boolean;
  // 今期の時間割（共有をONにしたときに送る）
  // 曜日・時限が空の行はサーバーで除く
  courses: { day?: string; period?: number | string; name: string; room?: string }[];
}

interface FriendView {
  name: string;
  friendCode: string;
}

interface MeData {
  name: string;
  friendCode: string;
  shareScheduleStatus: boolean;
  friends: FriendView[];
  incoming: FriendView[];
  outgoing: FriendView[];
}

type ApiResult = { ok: boolean; message?: string; error?: string; http: number; [key: string]: unknown };

async function callFriendsApi(token: string, action: string, payload: Record<string, unknown> = {}): Promise<ApiResult> {
  try {
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: false, ...data, http: res.status };
  } catch {
    return { ok: false, http: 0, message: 'サーバーに接続できませんでした。通信環境を確認してください。' };
  }
}

/** 端末の時間割を、共有してよい項目（曜日・時限・科目名・教室）だけにする */
export const toSharedCourses = (courses: Props['courses']) => courses.map((c) => ({ day: c.day || '', period: Number(c.period), name: c.name, room: c.room || '' }));

/** フレンドに見せる時間割をサーバーに送る（共有OFFならサーバーは保存しない） */
export async function syncSharedSchedule(token: string, courses: Props['courses']) {
  return callFriendsApi(token, 'sync_schedule', { courses: toSharedCourses(courses) });
}

const BADGE_STYLES: Record<FriendSlotStatus['kind'], string> = {
  class: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  free: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  private: 'bg-slate-100 text-slate-600 border-slate-200',
  unregistered: 'bg-slate-100 text-slate-600 border-slate-200',
  off_hours: 'bg-slate-100 text-slate-600 border-slate-200'
};

export default function FriendsPanel({ loginId, serverLinked, courses }: Props) {
  const [token, setToken] = useState<string | null>(() => getSessionToken(loginId));
  const [me, setMe] = useState<MeData | null>(null);
  const [statuses, setStatuses] = useState<FriendCurrentStatus[]>([]);
  const [slot, setSlot] = useState<CampusSlot | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleResult = useCallback((r: ApiResult) => {
    // 印が期限切れ・無効なら、パスワードを聞き直す
    if (r.http === 401) setToken(null);
    return r;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [meRes, statusRes] = await Promise.all([callFriendsApi(token, 'me'), callFriendsApi(token, 'status')]);
    handleResult(meRes);
    if (meRes.ok) {
      setMe(meRes as unknown as MeData);
      setLoadError(null);
    } else if (meRes.http !== 401) {
      setLoadError(meRes.message || '読み込めませんでした。');
    }
    if (statusRes.ok) {
      setStatuses(statusRes.friends as FriendCurrentStatus[]);
      setSlot(statusRes.slot as CampusSlot);
    }
  }, [token, handleResult]);

  // 開いている間は1分ごとに今のコマを更新する
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const run = () => {
      if (alive) void refresh();
    };
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 60_000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [token, refresh]);

  if (!serverLinked) {
    return (
      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 leading-relaxed" data-friends-unavailable>
        フレンド機能は、サーバーに登録したアカウントで使えます。デモアカウントでは使えません。ログイン画面の「新規学生登録」からアカウントを作ってください。
      </div>
    );
  }

  if (!token) {
    return (
      <form
        className="p-3 rounded-lg border border-slate-200 bg-white space-y-2"
        data-friends-relogin
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage(null);
          const res = await callAccountApi('login', { loginId, password });
          setBusy(false);
          if (res.ok && res.sessionToken) {
            saveSessionToken(loginId, res.sessionToken, false);
            setPassword('');
            setToken(res.sessionToken);
            void syncSharedSchedule(res.sessionToken, courses);
          } else {
            setMessage({ text: res.message || 'パスワードが違います。', error: true });
          }
        }}
      >
        <p className="text-xs text-slate-700">フレンド機能を使うには、確認のためパスワードをもう一度入力してください。</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-label="パスワード"
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-base sm:text-sm"
        />
        <button type="submit" disabled={busy || !password} className="w-full min-h-11 sm:min-h-0 py-2 bg-slate-900 text-white rounded-md text-xs font-semibold disabled:opacity-50">
          {busy ? '確認中…' : 'フレンド機能を開く'}
        </button>
        {message && <p className={`text-xs ${message.error ? 'text-rose-700' : 'text-emerald-700'}`}>{message.text}</p>}
      </form>
    );
  }

  const act = async (action: string, payload: Record<string, unknown>, success?: string) => {
    setBusy(true);
    setMessage(null);
    const res = handleResult(await callFriendsApi(token, action, payload));
    setBusy(false);
    if (res.ok || res.message) setMessage({ text: (res.message as string) || success || '更新しました。', error: !res.ok });
    await refresh();
    return res;
  };

  const statusOf = (friendCode: string) => statuses.find((s) => s.friendCode === friendCode);

  return (
    <div className="space-y-3 text-xs" data-friends-panel>
      <p className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
        🔒 フレンドに見せるのは、名前と、今の曜限の授業（科目名・教室）か空きコマかだけです。成績・GPA・ログインID・メールアドレスは見せません。
      </p>

      {loadError && <p className="text-rose-700">{loadError}</p>}

      {/* 自分のコード */}
      <div className="p-3 rounded-lg border border-slate-200 bg-white">
        <div className="font-semibold text-slate-800 mb-1.5">あなたのフレンドコード</div>
        <div className="flex items-center gap-2">
          <code data-my-friend-code className="flex-1 px-3 py-2 rounded-md bg-slate-100 text-slate-900 text-lg font-bold tracking-[0.2em] text-center">
            {me?.friendCode || '・・・・'}
          </code>
          <button
            type="button"
            disabled={!me?.friendCode}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(me!.friendCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setMessage({ text: 'コピーできませんでした。コードを長押ししてコピーしてください。', error: true });
              }
            }}
            className="min-h-11 sm:min-h-0 px-3 py-2 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-50"
          >
            {copied ? '✓ コピー済み' : 'コピー'}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">友達にこのコードを伝えると、フレンド申請を送ってもらえます。</p>
      </div>

      {/* プライバシー設定 */}
      <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-800">フレンドに今の状況を共有する</div>
          <div className="text-[11px] text-slate-500">オフにすると、フレンドには「非公開」と表示され、時間割はサーバーから消えます。</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!me?.shareScheduleStatus}
          aria-label="フレンドに今の状況を共有する"
          disabled={busy || !me}
          data-share-toggle
          onClick={() =>
            void act('set_sharing', { share: !me?.shareScheduleStatus, courses: toSharedCourses(courses) }, me?.shareScheduleStatus ? '共有をオフにしました。' : '共有をオンにしました。')
          }
          className={`shrink-0 w-12 h-7 rounded-full p-1 transition ${me?.shareScheduleStatus ? 'bg-emerald-600' : 'bg-slate-300'}`}
        >
          <span className={`block w-5 h-5 rounded-full bg-white shadow transition ${me?.shareScheduleStatus ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* 追加 */}
      <form
        className="p-3 rounded-lg border border-slate-200 bg-white space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!code.trim()) return;
          const res = await act('request', { friendCode: code });
          if (res.ok) setCode('');
        }}
      >
        <label htmlFor="friend-code-input" className="block font-semibold text-slate-800">
          フレンドを追加
        </label>
        <div className="flex gap-2">
          <input
            id="friend-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="例: K7Q2M9XA"
            maxLength={12}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-md text-base sm:text-sm tracking-widest uppercase"
          />
          <button type="submit" disabled={busy || !code.trim()} className="min-h-11 sm:min-h-0 px-3 py-2 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-50">
            申請する
          </button>
        </div>
      </form>

      {message && (
        <p role="status" data-friends-message className={`px-1 ${message.error ? 'text-rose-700' : 'text-emerald-700'}`}>
          {message.text}
        </p>
      )}

      {/* 届いた申請・送った申請 */}
      {!!me?.incoming.length && (
        <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
          <div className="font-semibold text-amber-900">フレンド申請が届いています</div>
          {me.incoming.map((f) => (
            <div key={f.friendCode} data-incoming={f.name} className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{f.name}</span>
              <div className="flex gap-1.5">
                <button type="button" disabled={busy} onClick={() => void act('respond', { friendCode: f.friendCode, accept: true }, `${f.name}さんとフレンドになりました。`)} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold">
                  承認
                </button>
                <button type="button" disabled={busy} onClick={() => void act('respond', { friendCode: f.friendCode, accept: false }, '申請を断りました。')} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700">
                  断る
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!!me?.outgoing.length && (
        <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5">
          <div className="font-semibold text-slate-800">承認待ち</div>
          {me.outgoing.map((f) => (
            <div key={f.friendCode} className="flex items-center justify-between">
              <span className="text-slate-700">{f.name}</span>
              <button type="button" disabled={busy} onClick={() => void act('remove', { friendCode: f.friendCode }, '申請を取り消しました。')} className="text-[11px] text-slate-500 underline">
                取り消す
              </button>
            </div>
          ))}
        </div>
      )}

      {/* フレンド一覧 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">フレンド（{me?.friends.length ?? 0}人）</span>
          <span className="text-[11px] text-slate-500">{slot ? slotHeading(slot) : ''}</span>
        </div>
        {me && me.friends.length === 0 && <p className="text-slate-500">まだフレンドがいません。友達のフレンドコードを入力して申請してください。</p>}
        {me?.friends.map((f) => {
          const s = statusOf(f.friendCode);
          const badges = s && slot ? cardBadges(s, slot) : null;
          return (
            <div key={f.friendCode} data-friend-card={f.name} className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-sm">{f.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`${f.name}さんをフレンドから外しますか？`)) void act('remove', { friendCode: f.friendCode }, 'フレンドから外しました。');
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-700"
                >
                  外す
                </button>
              </div>
              {badges && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span data-status-badge className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${BADGE_STYLES[badges.mainKind]}`}>
                    {badges.main}
                  </span>
                  {badges.sub && (
                    <span data-next-badge className="px-2 py-1 rounded-md border border-slate-200 text-[11px] text-slate-600">
                      {badges.sub}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
