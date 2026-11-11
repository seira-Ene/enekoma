// スマホの自動化（iPhoneのショートカット・Androidの自動化アプリ）から「到着」「出発」を受け取り、
// EneKomaを開いていない間の自動出欠に使う。受け取るのは到着か出発かと時刻だけで、緯度・経度は受け取らない。
//
// - 自動化からの送信: POST /api/campus-hook?t=<自動化用の鍵>&e=arrive|leave（ログイン不要。鍵で本人を決める）
// - 画面から（Authorization: Bearer <ログイン中の印>）: { action: 'create' | 'revoke' | 'events' }
import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { allowAttempt, getAccount, kvDel, kvGet, kvSet, StorageUnavailableError } from '../account/accountStore';
import { authenticate } from '../friends/auth';
import { requestTime } from '../friends/requestTime';

export const dynamic = 'force-dynamic';

// 到着・出発の記録は36時間で消す（その日の出欠を決めるのに足りる長さ）
const EVENT_TTL_SECONDS = 36 * 60 * 60;
const MAX_EVENTS = 40;

export interface CampusHookEvent {
  t: number; // 受け取った時刻（ミリ秒）
  on: boolean; // 到着なら true、出発なら false
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const hookKey = (tokenHash: string) => `campus_hook:${tokenHash}`;
const ownerKey = (loginId: string) => `campus_hook_of:${loginId}`;
const eventsKey = (loginId: string) => `campus_events:${loginId}`;

const fail = (status: number, error: string, message: string) => NextResponse.json({ ok: false, error, message }, { status });

async function readEvents(loginId: string, now: number): Promise<CampusHookEvent[]> {
  try {
    const parsed = JSON.parse((await kvGet(eventsKey(loginId))) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((e) => typeof e?.t === 'number' && typeof e?.on === 'boolean' && now - e.t < EVENT_TTL_SECONDS * 1000)
      : [];
  } catch {
    return [];
  }
}

// 自動化からの送信
async function receiveHook(request: NextRequest, token: string, event: string) {
  if (!token || token.length > 100 || (event !== 'arrive' && event !== 'leave')) {
    return fail(400, 'invalid_request', 'URLが正しくありません。EneKomaの「出欠」タブからURLをコピーし直してください。');
  }
  const loginId = await kvGet(hookKey(hash(token)));
  if (!loginId) return fail(404, 'unknown_hook', 'このURLは無効です。EneKomaの「出欠」タブで新しいURLを作ってください。');
  if (!(await allowAttempt(`campus_hook:${loginId}`, 30, 60 * 60))) {
    return fail(429, 'rate_limited', '短い時間に送信が多すぎます。しばらくしてからお試しください。');
  }
  const now = requestTime(request).getTime();
  const on = event === 'arrive';
  const events = [...(await readEvents(loginId, now)), { t: now, on }].slice(-MAX_EVENTS);
  await kvSet(eventsKey(loginId), JSON.stringify(events), { ttlSeconds: EVENT_TTL_SECONDS });
  return NextResponse.json({ ok: true, recorded: on ? '到着' : '出発', message: on ? 'EneKomaに到着を記録しました。' : 'EneKomaに出発を記録しました。' });
}

// 画面からの操作（ログイン中の本人だけ）
async function handleApp(request: NextRequest, body: Record<string, unknown>) {
  const me = await authenticate(request, body);
  if (!me || !(await getAccount(me))) return fail(401, 'unauthorized', 'この機能を使うには、もう一度ログインしてください。');
  const now = requestTime(request).getTime();

  switch (body.action) {
    // 新しい鍵を作る（前の鍵は使えなくする）。鍵そのものはサーバーに残さず、ハッシュだけ保存する
    case 'create': {
      const old = await kvGet(ownerKey(me));
      if (old) await kvDel(hookKey(old));
      const token = randomBytes(24).toString('base64url');
      await kvSet(hookKey(hash(token)), me);
      await kvSet(ownerKey(me), hash(token));
      return NextResponse.json({ ok: true, token });
    }
    // 鍵を無効にし、届いた記録も消す
    case 'revoke': {
      const old = await kvGet(ownerKey(me));
      if (old) await kvDel(hookKey(old));
      await kvDel(ownerKey(me));
      await kvDel(eventsKey(me));
      return NextResponse.json({ ok: true });
    }
    case 'events': {
      const active = !!(await kvGet(ownerKey(me)));
      return NextResponse.json({ ok: true, active, events: active ? await readEvents(me, now) : [] });
    }
    default:
      return fail(400, 'unknown_action', '不正なリクエストです。');
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('t');
    if (token !== null) return await receiveHook(request, token, request.nextUrl.searchParams.get('e') || '');
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'invalid_body', '不正なリクエストです。');
    }
    return await handleApp(request, body);
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) console.error('Campus hook API error:', error);
    return fail(503, 'storage_unavailable', 'サーバーに接続できませんでした。しばらくしてからお試しください。');
  }
}
