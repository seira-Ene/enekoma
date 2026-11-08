// フレンドの「今の授業・空きコマ」の判定と、チャットの答えの文。共有するのは曜日・時限・科目名・教室だけ
import { getCampusClock, PERIOD_TIMES, resolvePeriodAt } from './courses';

/** フレンドに共有する時間割の1コマ（成績・GPA・個人情報は含めない） */
export interface SharedCourse {
  day: string;
  period: number;
  name: string;
  room: string;
}

export const SHARE_DAYS = ['月', '火', '水', '木', '金', '土'];
const MAX_SHARED_COURSES = 60;

/** 端末から送られた時間割を、共有してよい項目だけ・決まった形にそろえる */
export function sanitizeSharedSchedule(input: unknown): SharedCourse[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: SharedCourse[] = [];
  for (const raw of input.slice(0, MAX_SHARED_COURSES * 2)) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Record<string, unknown>;
    const day = String(c.day ?? '').replace(/曜.*$/, '').trim();
    const period = Number(c.period);
    const name = String(c.name ?? '').trim().slice(0, 60);
    const room = String(c.room ?? '').trim().slice(0, 40);
    if (!SHARE_DAYS.includes(day) || !Number.isInteger(period) || period < 1 || period > 7 || !name) continue;
    const key = `${day}${period}${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ day, period, name, room });
    if (out.length >= MAX_SHARED_COURSES) break;
  }
  return out;
}

export interface CampusSlot {
  day: string;
  // 今の時限（授業の合間は次の時限）。授業時間外は null
  period: number | null;
  inClass: boolean;
  // 例: 「火曜3限」
  label: string;
  next: { day: string; period: number; label: string } | null;
}

const LAST_PERIOD = PERIOD_TIMES[PERIOD_TIMES.length - 1].period;
const slotLabel = (day: string, period: number) => `${day}曜${period}限`;

/** 閲覧した時刻の曜日・時限（日本時間）。日曜と5限のあとは授業時間外 */
export function campusSlotAt(now: Date = new Date()): CampusSlot {
  const clock = getCampusClock(now);
  const { period, status } = resolvePeriodAt(clock.minutes);
  if (!SHARE_DAYS.includes(clock.day) || period === null) {
    return { day: clock.day, period: null, inClass: false, label: '授業時間外', next: null };
  }
  const next = period < LAST_PERIOD ? { day: clock.day, period: period + 1, label: slotLabel(clock.day, period + 1) } : null;
  return { day: clock.day, period, inClass: status === 'class', label: slotLabel(clock.day, period), next };
}

export type FriendStatusKind = 'class' | 'free' | 'private' | 'unregistered' | 'off_hours';

export interface FriendSlotStatus {
  kind: FriendStatusKind;
  slot: string;
  course?: string;
  room?: string;
}

export function statusAtSlot(courses: SharedCourse[], day: string, period: number): FriendSlotStatus {
  const slot = slotLabel(day, period);
  const course = courses.find((c) => c.day === day && c.period === period);
  return course ? { kind: 'class', slot, course: course.name, room: course.room } : { kind: 'free', slot };
}

export interface FriendCurrentStatus {
  name: string;
  friendCode: string;
  now: FriendSlotStatus;
  next: FriendSlotStatus | null;
}

/** 1人分の今と次のコマ。共有を止めている人は「非公開」、時間割を送っていない人は「時間割未登録」 */
export function friendStatusAt(
  friend: { name: string; friendCode: string; share: boolean; courses: SharedCourse[] | null },
  slot: CampusSlot
): FriendCurrentStatus {
  const base = { name: friend.name, friendCode: friend.friendCode };
  if (!friend.share) return { ...base, now: { kind: 'private', slot: slot.label }, next: null };
  if (slot.period === null) return { ...base, now: { kind: 'off_hours', slot: slot.label }, next: null };
  if (!friend.courses || friend.courses.length === 0) return { ...base, now: { kind: 'unregistered', slot: slot.label }, next: null };
  return {
    ...base,
    now: statusAtSlot(friend.courses, slot.day, slot.period),
    next: slot.next ? statusAtSlot(friend.courses, slot.next.day, slot.next.period) : null
  };
}

/** カードのバッジの文。例: 「火曜3限: 空きコマ」「火曜3限: 3号館3302（ソフトウェアクリエイション1）」 */
export function badgeText(s: FriendSlotStatus): string {
  switch (s.kind) {
    case 'class':
      return `${s.slot}: ${s.room ? `${s.room}（${s.course}）` : s.course}`;
    case 'free':
      return `${s.slot}: 空きコマ`;
    case 'private':
      return '非公開';
    case 'unregistered':
      return '時間割未登録';
    default:
      return '授業時間外';
  }
}

export interface FriendsStatusResult {
  slot: CampusSlot;
  friends: FriendCurrentStatus[];
}

// ---- チャット ----

const FRIEND_WORDS = /(友達|友だち|ともだち|フレンド|友人)/;
// 「誰」「だれ」は「誰が空きコマ」「誰がどこにいる」のときだけ（「この授業の先生は誰」は時間割の検索）
const WHO_WORDS = /(誰|だれ)/;
const WHO_STATUS_WORDS = /(空きコマ|あきコマ|空いて|あいて|いる|一緒|いっしょ)/;
const STATUS_WORDS = /(空き|あき|どこ|教室|いる|授業|一緒|いっしょ|何して|なにして|今|いま)/;

const compact = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');

/** 質問に出てくるフレンドの名前（フルネーム、または2文字以上の姓・名の一部） */
export function mentionedFriends(query: string, names: string[]): string[] {
  const q = compact(query);
  return names.filter((name) => {
    const full = compact(name);
    if (full.length >= 2 && q.includes(full)) return true;
    return name
      .normalize('NFKC')
      .split(/[\s　]+/)
      .some((part) => part.length >= 2 && q.includes(part));
  });
}

/** フレンドの居場所・空きコマを聞いているか（「空き教室」の検索は含めない） */
export function isFriendStatusQuery(query: string, friendNames: string[] = []): boolean {
  const q = compact(query);
  if (!STATUS_WORDS.test(q)) return false;
  if (FRIEND_WORDS.test(q)) return true;
  if (WHO_WORDS.test(q) && WHO_STATUS_WORDS.test(q)) return true;
  return mentionedFriends(q, friendNames).length > 0;
}

/** フレンドの名前が分からなくても、フレンドの質問かもしれないか（サーバーを呼ぶ前のふるい分け） */
export const mayBeFriendStatusQuery = (query: string) => STATUS_WORDS.test(compact(query)) && /(さん|くん|君|ちゃん|友|フレンド|誰|だれ)/.test(query);

const joinNames = (list: { name: string }[]) => list.map((f) => `${f.name}さん`).join('、');
const where = (s: FriendSlotStatus) => (s.room ? `${s.room}で${s.course}の授業を受けています` : `${s.course}の授業を受けています`);

/**
 * get_friends_current_status の結果からチャットの答えを作る（AIに推測させない）。
 * myCourses は質問した本人の時間割（「次のコマで一緒に空きコマ」の判定に使う）
 */
export function answerFriendStatusQuery(query: string, result: FriendsStatusResult, myCourses: SharedCourse[] = []): string {
  const { slot, friends } = result;
  if (friends.length === 0) {
    return 'まだフレンドがいません。プロフィールの「フレンド」タブで、友達のフレンドコードを入力して申請してください。';
  }
  if (slot.period === null) {
    return `今は授業時間外です（月〜土の1〜${LAST_PERIOD}限で判定します）。授業のある時間にもう一度聞いてください。`;
  }
  const when = `${slot.inClass ? '現在' : '次の授業'}（${slot.label}）`;
  const visible = friends.filter((f) => f.now.kind === 'class' || f.now.kind === 'free');
  const hidden = friends.filter((f) => f.now.kind === 'private' || f.now.kind === 'unregistered');
  const hiddenNote = hidden.length ? `${joinNames(hidden)}は時間割を共有していないため分かりません。` : '';

  // 名前を指定した質問
  const named = mentionedFriends(query, friends.map((f) => f.name));
  if (named.length > 0) {
    return friends
      .filter((f) => named.includes(f.name))
      .map((f) => {
        if (f.now.kind === 'private' || f.now.kind === 'unregistered') return `${f.name}さんは時間割を共有していないため、今どこにいるかは分かりません。`;
        const now = f.now.kind === 'class' ? `${f.name}さんは${where(f.now)}` : `${f.name}さんは空きコマです`;
        const next = f.next ? (f.next.kind === 'class' ? `その次（${f.next.slot}）は${f.next.room || f.next.course}です。` : `その次（${f.next.slot}）${f.now.kind === 'free' ? 'も' : 'は'}空きコマです。`) : '';
        return `${when}、${now}。${next}`;
      })
      .join('\n');
  }

  // 次のコマで一緒に空きコマ
  if (/次/.test(query) && slot.next) {
    const nextSlot = slot.next;
    const freeNext = visible.filter((f) => f.next?.kind === 'free');
    const meBusy = myCourses.find((c) => c.day === nextSlot.day && c.period === nextSlot.period);
    const mine = meBusy ? `あなたは${nextSlot.label}に${meBusy.name}があります。` : `あなたも${nextSlot.label}は空きコマです。`;
    if (freeNext.length === 0) return `${nextSlot.label}に空きコマのフレンドはいません。${mine}${hiddenNote}`;
    return `${nextSlot.label}は、${joinNames(freeNext)}が空きコマです。${mine}${meBusy ? '' : '一緒に過ごせますね。'}${hiddenNote}`;
  }

  const free = visible.filter((f) => f.now.kind === 'free');
  const inClass = visible.filter((f) => f.now.kind === 'class');
  const parts: string[] = [];
  parts.push(free.length ? `${when}、${joinNames(free)}が空きコマです。` : `${when}、空きコマのフレンドはいません。`);
  if (inClass.length) parts.push(`${free.length ? 'また、' : ''}${inClass.map((f) => `${f.name}さんは${where(f.now)}`).join('、')}。`);
  if (hiddenNote) parts.push(hiddenNote);
  return parts.join('');
}
