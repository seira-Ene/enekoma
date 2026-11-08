// フレンド機能のAPI。ログイン時に受け取った印（Authorization: Bearer）で本人を確かめる
// 相手に見せるのは名前・フレンドコード・今の授業（科目名・教室）か空きコマかだけ
import { NextRequest, NextResponse } from 'next/server';
import {
  allowAttempt,
  ensureFriendCode,
  getAccount,
  loginIdForFriendCode,
  setShareScheduleStatus,
  sharesSchedule,
  StorageUnavailableError
} from '../account/accountStore';
import { sanitizeSharedSchedule } from '@/app/data/friendStatus';
import {
  deletePresence,
  deleteSharedSchedule,
  markOffline,
  touchPresence,
  get_friends_current_status,
  listFriends,
  removeFriendship,
  requestFriend,
  respondToRequest,
  saveSharedSchedule
} from './friendStore';
import { requestTime } from './requestTime';
import { authenticate } from './auth';

export const dynamic = 'force-dynamic';

const fail = (status: number, error: string, message: string) => NextResponse.json({ ok: false, error, message }, { status });

const REQUEST_MESSAGES: Record<string, string> = {
  requested: 'フレンド申請を送りました。相手が承認するとフレンドになります。',
  accepted: '相手からも申請が届いていたので、フレンドになりました。',
  already_friends: 'すでにフレンドです。',
  already_requested: 'すでに申請済みです。相手の承認を待っています。',
  self: '自分のフレンドコードは追加できません。',
  not_found: 'このフレンドコードの人は見つかりませんでした。コードをもう一度確認してください。'
};

async function handle(request: NextRequest, body: Record<string, unknown>) {
  const me = await authenticate(request, body);
  if (!me) return fail(401, 'unauthorized', 'フレンド機能を使うには、もう一度ログインしてください。');
  const account = await getAccount(me);
  if (!account) return fail(401, 'unauthorized', 'アカウントが見つかりませんでした。もう一度ログインしてください。');

  // アプリを開いている印（オンライン状態）。共有をOFFにしている人は保存しない
  const now = requestTime(request);
  if (body.action !== 'offline' && sharesSchedule(account)) await touchPresence(me, now);

  switch (body.action) {
    case 'heartbeat':
      return NextResponse.json({ ok: true });

    case 'offline':
      if (sharesSchedule(account)) await markOffline(me, now);
      return NextResponse.json({ ok: true });

    case 'me': {
      const friendCode = await ensureFriendCode(me);
      return NextResponse.json({ ok: true, name: account.name, friendCode, shareScheduleStatus: sharesSchedule(account), ...(await listFriends(me)) });
    }

    case 'sync_schedule': {
      // 共有を止めている人の時間割はサーバーに置かない
      if (!sharesSchedule(account)) {
        await deleteSharedSchedule(me);
        return NextResponse.json({ ok: true, shared: false });
      }
      const courses = sanitizeSharedSchedule(body.courses);
      await saveSharedSchedule(me, courses);
      return NextResponse.json({ ok: true, shared: true, count: courses.length });
    }

    case 'set_sharing': {
      const share = body.share === true;
      await setShareScheduleStatus(me, share);
      if (!share) await Promise.all([deleteSharedSchedule(me), deletePresence(me)]);
      else {
        await touchPresence(me, now);
        if (Array.isArray(body.courses)) await saveSharedSchedule(me, sanitizeSharedSchedule(body.courses));
      }
      return NextResponse.json({ ok: true, shareScheduleStatus: share });
    }

    case 'request': {
      if (!(await allowAttempt(`friend-request:${me.toLowerCase()}`, 20, 3600))) {
        return fail(429, 'rate_limited', '申請の回数が多すぎます。しばらくしてからお試しください。');
      }
      const { result, name } = await requestFriend(me, String(body.friendCode || ''));
      const ok = result === 'requested' || result === 'accepted' || result === 'already_friends' || result === 'already_requested';
      return NextResponse.json({ ok, result, name, message: REQUEST_MESSAGES[result] }, { status: ok ? 200 : result === 'not_found' ? 404 : 400 });
    }

    case 'respond': {
      const done = await respondToRequest(me, String(body.friendCode || ''), body.accept === true);
      if (!done) return fail(404, 'not_found', 'この申請は見つかりませんでした。');
      return NextResponse.json({ ok: true });
    }

    case 'remove': {
      const other = await loginIdForFriendCode(String(body.friendCode || ''));
      if (!other) return fail(404, 'not_found', 'このフレンドは見つかりませんでした。');
      await removeFriendship(me, other);
      return NextResponse.json({ ok: true });
    }

    case 'status': {
      const result = await get_friends_current_status(me, now);
      return NextResponse.json({ ok: true, ...result });
    }

    default:
      return fail(400, 'unknown_action', '不正なリクエストです。');
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'invalid_body', '不正なリクエストです。');
  }
  try {
    return await handle(request, body);
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) console.error('Friends API error:', error);
    return fail(503, 'storage_unavailable', 'サーバーに接続できませんでした。しばらくしてからお試しください。');
  }
}
