// フレンドの関係と、フレンドに見せる時間割（曜日・時限・科目名・教室だけ）の保存
// 保存先はアカウントと同じ（Redis、ローカル開発ではメモリ）。成績・GPA・メールアドレスはここに置かない
import {
  ensureFriendCode,
  getAccount,
  kvDel,
  kvGet,
  kvSet,
  loginIdForFriendCode,
  normalizeLoginId,
  setAdd,
  setMembers,
  setRemove,
  sharesSchedule
} from '../account/accountStore';
import { campusAt, campusSlotAt, compareCampus, friendStatusAt, FriendsStatusResult, SharedCourse } from '@/app/data/friendStatus';

export type FriendshipStatus = 'pending' | 'accepted';

/** friendships：user_id_1 が申請した人、user_id_2 が申請された人 */
export interface Friendship {
  userId1: string;
  userId2: string;
  status: FriendshipStatus;
  createdAt: string;
  acceptedAt?: string;
}

const id = (loginId: string) => normalizeLoginId(loginId).toLowerCase();
const pairKey = (a: string, b: string) => `friendship:${[id(a), id(b)].sort().join('|')}`;
const friendsKey = (u: string) => `friends:${id(u)}`;
const incomingKey = (u: string) => `friendreq:in:${id(u)}`;
const outgoingKey = (u: string) => `friendreq:out:${id(u)}`;
const scheduleKey = (u: string) => `schedule:${id(u)}`;

export async function getFriendship(a: string, b: string): Promise<Friendship | null> {
  const raw = await kvGet(pairKey(a, b));
  return raw ? (JSON.parse(raw) as Friendship) : null;
}

export type RequestResult = 'requested' | 'accepted' | 'already_friends' | 'already_requested' | 'self' | 'not_found';

/** フレンドコードで申請する。相手から申請が来ていれば、その場で承認にする */
export async function requestFriend(fromLoginId: string, friendCode: string): Promise<{ result: RequestResult; name?: string }> {
  const toLoginId = await loginIdForFriendCode(friendCode);
  const target = toLoginId ? await getAccount(toLoginId) : null;
  if (!target) return { result: 'not_found' };
  if (id(target.loginId) === id(fromLoginId)) return { result: 'self' };
  const existing = await getFriendship(fromLoginId, target.loginId);
  if (existing?.status === 'accepted') return { result: 'already_friends', name: target.name };
  if (existing && id(existing.userId1) === id(fromLoginId)) return { result: 'already_requested', name: target.name };
  if (existing) {
    await acceptFriendship(existing);
    return { result: 'accepted', name: target.name };
  }
  const friendship: Friendship = { userId1: id(fromLoginId), userId2: id(target.loginId), status: 'pending', createdAt: new Date().toISOString() };
  await kvSet(pairKey(fromLoginId, target.loginId), JSON.stringify(friendship));
  await setAdd(outgoingKey(fromLoginId), id(target.loginId));
  await setAdd(incomingKey(target.loginId), id(fromLoginId));
  return { result: 'requested', name: target.name };
}

async function acceptFriendship(f: Friendship) {
  const next: Friendship = { ...f, status: 'accepted', acceptedAt: new Date().toISOString() };
  await kvSet(pairKey(f.userId1, f.userId2), JSON.stringify(next));
  await setRemove(outgoingKey(f.userId1), f.userId2);
  await setRemove(incomingKey(f.userId2), f.userId1);
  await setAdd(friendsKey(f.userId1), f.userId2);
  await setAdd(friendsKey(f.userId2), f.userId1);
}

/** 届いた申請に答える。承認しなければ申請を消す */
export async function respondToRequest(meLoginId: string, friendCode: string, accept: boolean): Promise<boolean> {
  const otherId = await loginIdForFriendCode(friendCode);
  if (!otherId) return false;
  const f = await getFriendship(meLoginId, otherId);
  if (!f || f.status !== 'pending' || id(f.userId2) !== id(meLoginId)) return false;
  if (accept) await acceptFriendship(f);
  else await removeFriendship(meLoginId, otherId);
  return true;
}

/** フレンドを外す。送った申請の取り消しにも使う */
export async function removeFriendship(meLoginId: string, otherLoginId: string) {
  await kvDel(pairKey(meLoginId, otherLoginId));
  for (const [a, b] of [[meLoginId, otherLoginId], [otherLoginId, meLoginId]]) {
    await setRemove(friendsKey(a), id(b));
    await setRemove(outgoingKey(a), id(b));
    await setRemove(incomingKey(a), id(b));
  }
}

export interface FriendView {
  name: string;
  friendCode: string;
}

async function views(loginIds: string[]): Promise<(FriendView & { loginId: string; share: boolean })[]> {
  const accounts = await Promise.all(loginIds.map((u) => getAccount(u)));
  const out: (FriendView & { loginId: string; share: boolean })[] = [];
  for (const account of accounts) {
    if (!account) continue;
    const friendCode = account.friendCode || (await ensureFriendCode(account.loginId)) || '';
    out.push({ loginId: account.loginId, name: account.name, friendCode, share: sharesSchedule(account) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

/** フレンド画面の一覧。相手のログインIDは返さない（名前とフレンドコードだけ） */
export async function listFriends(meLoginId: string): Promise<{ friends: FriendView[]; incoming: FriendView[]; outgoing: FriendView[] }> {
  const [friends, incoming, outgoing] = await Promise.all([
    setMembers(friendsKey(meLoginId)).then(views),
    setMembers(incomingKey(meLoginId)).then(views),
    setMembers(outgoingKey(meLoginId)).then(views)
  ]);
  const strip = (list: { name: string; friendCode: string }[]) => list.map(({ name, friendCode }) => ({ name, friendCode }));
  return { friends: strip(friends), incoming: strip(incoming), outgoing: strip(outgoing) };
}

/** 相手がフレンド（承認済み）か */
export async function isFriend(meLoginId: string, otherLoginId: string) {
  return (await getFriendship(meLoginId, otherLoginId))?.status === 'accepted';
}

// ---- フレンドに見せる時間割 ----
export async function saveSharedSchedule(loginId: string, courses: SharedCourse[]) {
  await kvSet(scheduleKey(loginId), JSON.stringify({ courses, updatedAt: new Date().toISOString() }));
}

export async function deleteSharedSchedule(loginId: string) {
  await kvDel(scheduleKey(loginId));
}

// ---- 校内 / 校外（共有をONにしている人だけ。端末で判定した結果だけで、緯度・経度は受け取らない） ----
const campusKey = (loginId: string) => `campus:${id(loginId)}`;
const CAMPUS_TTL_SECONDS = 24 * 60 * 60;

export async function saveCampusStatus(loginId: string, onCampus: boolean, now: Date = new Date()) {
  await kvSet(campusKey(loginId), JSON.stringify({ onCampus, at: now.toISOString() }), { ttlSeconds: CAMPUS_TTL_SECONDS });
}

export async function deleteCampusStatus(loginId: string) {
  await kvDel(campusKey(loginId));
}

async function getCampusStatus(loginId: string): Promise<{ onCampus: boolean; at: string } | null> {
  const raw = await kvGet(campusKey(loginId));
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getSharedSchedule(loginId: string): Promise<SharedCourse[] | null> {
  const raw = await kvGet(scheduleKey(loginId));
  return raw ? (JSON.parse(raw).courses as SharedCourse[]) : null;
}

/**
 * AIチャットのツール get_friends_current_status。ログイン中の人の承認済みフレンドについて、
 * 閲覧時刻の曜日・時限で授業中（科目名・教室）か空きコマかを返す。共有を止めている人は「非公開」
 */
export async function get_friends_current_status(meLoginId: string, now: Date = new Date(), options: { withSchedule?: boolean } = {}): Promise<FriendsStatusResult> {
  const slot = campusSlotAt(now);
  const friends = await views(await setMembers(friendsKey(meLoginId)));
  const statuses = await Promise.all(
    friends.map(async (f) => {
      const [courses, campus] = f.share ? await Promise.all([getSharedSchedule(f.loginId), getCampusStatus(f.loginId)]) : [null, null];
      const status = friendStatusAt({ name: f.name, friendCode: f.friendCode, share: f.share, courses, campus: f.share ? campusAt(campus, now) : null }, slot);
      // 共通の授業・空きコマを調べるときだけ、共有された時間割（曜日・時限・科目名・教室）を付ける
      return options.withSchedule && f.share && courses ? { ...status, schedule: courses } : status;
    })
  );
  return { slot, friends: statuses.sort(compareCampus) };
}
