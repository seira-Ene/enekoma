'use client';

// 「EneKomaを開いていないときも出欠をつける」：スマホの自動化（到着・出発）に貼るURLを作る・消す
import { useState } from 'react';
import { createHook, hookUrl, revokeHook, saveHookToken, type CampusHookEvent } from '@/app/data/campusHook';
import { CAMPUS } from '@/app/data/campusLocation';

interface Props {
  accountId: string | null;
  sessionToken: string | null;
  token: string | null; // この端末に保存した自動化用の鍵
  lastEvent: CampusHookEvent | null;
  onChange: (token: string | null) => void;
}

const formatTime = (t: number) =>
  new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t));

function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-slate-700">{label}</div>
      <div className="flex items-center gap-1.5 min-w-0">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={label} className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-[11px] text-slate-700 font-mono" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // コピーできない端末では、欄を選んで手でコピーしてもらう
            }
          }}
          className="shrink-0 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-[11px] font-semibold"
        >
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
    </div>
  );
}

export default function CampusAutomationCard({ accountId, sessionToken, token, lastEvent, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [os, setOs] = useState<'ios' | 'android'>(() => (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? 'android' : 'ios'));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5" data-campus-automation>
      <div>
        <div className="font-semibold text-slate-800 text-xs">📲 EneKomaを開いていないときも記録する</div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          ブラウザは、アプリを閉じている間は位置情報を取れません。スマホの自動化で{CAMPUS.name}への「到着」「出発」をEneKomaに送ると、次に開いたときに、その間の授業の出欠を自動でつけます。送るのは到着か出発かと時刻だけで、36時間で消えます。
        </p>
      </div>

      {!accountId || !sessionToken ? (
        <p className="text-[11px] text-slate-600">この機能を使うには、ログインしてください（デモアカウントでは使えません）。</p>
      ) : !token ? (
        <button
          type="button"
          disabled={busy}
          data-campus-hook-create
          onClick={() =>
            run(async () => {
              const { token: created } = await createHook(sessionToken);
              saveHookToken(accountId, created);
              onChange(created);
            })
          }
          className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-60"
        >
          {busy ? '作成中…' : '自動化用のURLを作る'}
        </button>
      ) : (
        <div className="space-y-2.5">
          <CopyRow label="① 到着したときに送るURL" url={hookUrl(token, 'arrive')} />
          <CopyRow label="② 出発したときに送るURL" url={hookUrl(token, 'leave')} />

          <div role="tablist" aria-label="スマホの種類" className="flex gap-1">
            {(['ios', 'android'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={os === k}
                onClick={() => setOs(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${os === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {k === 'ios' ? 'iPhone' : 'Android'}
              </button>
            ))}
          </div>
          {os === 'ios' ? (
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-slate-700 leading-relaxed" data-campus-hook-steps="ios">
              <li>「ショートカット」アプリ →「オートメーション」→「＋」→「到着」を選ぶ</li>
              <li>場所に「日本大学文理学部」（世田谷区桜上水3-25-40）を選び、「すぐに実行」にする</li>
              <li>アクション「URLの内容を取得」を追加し、URLに①を貼って、方法を「POST」にする</li>
              <li>同じように「出発」のオートメーションを作り、②のURLを貼る</li>
            </ol>
          ) : (
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-slate-700 leading-relaxed" data-campus-hook-steps="android">
              <li>「MacroDroid」などの自動化アプリを入れ、新しいマクロを作る</li>
              <li>トリガーに「位置情報 → ジオフェンス」で文理学部（半径300m程度）を登録し、「エリアに入ったとき」を選ぶ</li>
              <li>アクションに「HTTPリクエスト」を追加し、方法を「POST」、URLに①を貼る</li>
              <li>同じように「エリアから出たとき」のマクロを作り、②のURLを貼る</li>
            </ol>
          )}

          <p className="text-[11px] text-slate-600" data-campus-hook-last>
            {lastEvent ? `最後に届いた記録：${formatTime(lastEvent.t)} ${lastEvent.on ? '到着' : '出発'}` : 'まだ記録は届いていません。設定したら、キャンパスへの到着を待つか、自動化を手で1回実行して確かめてください。'}
          </p>
          <button
            type="button"
            disabled={busy}
            data-campus-hook-revoke
            onClick={() =>
              run(async () => {
                await revokeHook(sessionToken);
                saveHookToken(accountId, null);
                onChange(null);
              })
            }
            className="text-[11px] text-rose-700 underline disabled:opacity-60"
          >
            このURLを無効にする（届いた記録も消します）
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-[11px] text-rose-700">{error}</p>}
    </div>
  );
}
