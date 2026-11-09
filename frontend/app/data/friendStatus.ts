// フレンドの「今の授業・空きコマ」と「今日の予定・次の授業」の判定と、チャットの答えの文。
// 共有するのは曜日・時限・科目名・教室だけ（成績・GPA・個人情報は使わない）
import { getCampusClock, PERIOD_TIMES, resolvePeriodAt } from './courses';
import { isSameCourseName } from './courseGrades';

/** フレンドに共有する時間割の1コマ（成績・GPA・個人情報は含めない） */
export interface SharedCourse {
  day: string;
  period: number;
  name: string;
  room: string;
}

export const SHARE_DAYS = ['月', '火', '水', '木', '金', '土'];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
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

/**
 * 閲覧した時刻の区分。
 * before: 1限の前（朝） / class: 授業中 / break: 休み時間・昼休み / after: 5限のあと（放課後・夜） / holiday: 日曜
 */
export type CampusPhase = 'before' | 'class' | 'break' | 'after' | 'holiday';

export interface CampusSlot {
  day: string;
  // 今の時限（休み時間と朝は次の時限）。放課後と休日は null
  period: number | null;
  inClass: boolean;
  phase: CampusPhase;
  // 0時からの分（日本時間）。フレンドの「もう授業が終わったか」の判定に使う
  minutes: number;
  // 例: 「火曜3限」。放課後・休日は「授業時間外」
  label: string;
  next: { day: string; period: number; label: string } | null;
}

const LAST_PERIOD = PERIOD_TIMES[PERIOD_TIMES.length - 1].period;
const slotLabel = (day: string, period: number) => `${day}曜${period}限`;
// 6・7限は時刻表にないので、5限のあとに100分ずつ続くものとして扱う
const periodTimes = (period: number) => {
  const known = PERIOD_TIMES.find((p) => p.period === period);
  if (known) return known;
  const last = PERIOD_TIMES[PERIOD_TIMES.length - 1];
  const start = last.end + 10 + (period - LAST_PERIOD - 1) * 100;
  return { period, start, end: start + 90 };
};
const clockText = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** 閲覧した時刻の曜日・時限（日本時間） */
export function campusSlotAt(now: Date = new Date()): CampusSlot {
  const clock = getCampusClock(now);
  const { period, status } = resolvePeriodAt(clock.minutes);
  const base = { day: clock.day, minutes: clock.minutes };
  if (!SHARE_DAYS.includes(clock.day)) return { ...base, period: null, inClass: false, phase: 'holiday', label: '授業時間外', next: null };
  if (period === null) return { ...base, period: null, inClass: false, phase: 'after', label: '授業時間外', next: null };
  const phase: CampusPhase = status === 'class' ? 'class' : status === 'before' ? 'before' : 'break';
  const next = period < LAST_PERIOD ? { day: clock.day, period: period + 1, label: slotLabel(clock.day, period + 1) } : null;
  return { ...base, period, inClass: phase === 'class', phase, label: slotLabel(clock.day, period), next };
}

export type FriendStatusKind = 'class' | 'free' | 'private' | 'unregistered' | 'off_hours';

export interface FriendSlotStatus {
  kind: FriendStatusKind;
  slot: string;
  course?: string;
  room?: string;
}

/** 次の授業（今日のこの先か、次の授業日）。daysAhead は今日なら0 */
export interface FriendNextClass {
  day: string;
  period: number;
  slot: string;
  course: string;
  room: string;
  daysAhead: number;
}

/**
 * 今日の予定。state は
 * no_classes: 今日は授業なし / before: 最初の授業の前 / during: 授業のある時間帯 / finished: 今日の授業はすべて終了
 */
export interface FriendDaySummary {
  day: string;
  courses: { period: number; name: string; room: string }[];
  first: number | null;
  last: number | null;
  // 最後の授業が終わる時刻（例: 16:10）
  endsAt: string | null;
  state: 'no_classes' | 'before' | 'during' | 'finished';
}

/**
 * オンライン状態。アプリを開いている間は1分ごとに知らせ、3分以上知らせがなければオフライン。
 * 共有をOFFにしている人は null（見せない）
 */
export interface FriendPresence {
  online: boolean;
  // 最後にアプリを開いていた時刻と、何分前か（サーバーの時刻で計算する）
  lastSeenAt: string | null;
  minutesAgo: number | null;
}

export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

/** サーバーに保存した最後の知らせから、今のオンライン状態を決める */
export function presenceAt(raw: { lastSeenAt: string; offline?: boolean } | null, now: Date): FriendPresence {
  const seen = raw ? new Date(raw.lastSeenAt).getTime() : NaN;
  if (!raw || Number.isNaN(seen)) return { online: false, lastSeenAt: null, minutesAgo: null };
  const ago = Math.max(0, now.getTime() - seen);
  return { online: !raw.offline && ago < ONLINE_WINDOW_MS, lastSeenAt: raw.lastSeenAt, minutesAgo: Math.floor(ago / 60000) };
}

/** 「オンライン」「オフライン（5分前）」「オフライン」 */
export function presenceLabel(p: FriendPresence | null | undefined): string {
  if (!p) return '';
  if (p.online) return 'オンライン';
  if (p.minutesAgo === null) return 'オフライン';
  const m = p.minutesAgo;
  const ago = m < 1 ? 'たった今' : m < 60 ? `${m}分前` : m < 60 * 24 ? `${Math.floor(m / 60)}時間前` : `${Math.floor(m / 1440)}日前`;
  return `オフライン（${ago}）`;
}

/** 一覧の並び：オンラインの人 → 最近までいた人 → 一度も来ていない・非公開の人（同じなら名前順） */
export function comparePresence(a: { name: string; presence?: FriendPresence | null }, b: { name: string; presence?: FriendPresence | null }): number {
  const rank = (p?: FriendPresence | null) => (p?.online ? 0 : p?.minutesAgo != null ? 1 : 2);
  const r = rank(a.presence) - rank(b.presence);
  if (r) return r;
  const am = a.presence?.minutesAgo ?? Infinity;
  const bm = b.presence?.minutesAgo ?? Infinity;
  if (am !== bm) return am - bm;
  return a.name.localeCompare(b.name, 'ja');
}

export interface FriendCurrentStatus {
  name: string;
  friendCode: string;
  presence: FriendPresence | null;
  now: FriendSlotStatus;
  next: FriendSlotStatus | null;
  today: FriendDaySummary | null;
  nextClass: FriendNextClass | null;
  // 今日のこの先で最初の空きコマ（今日の授業が終わっていれば null）
  nextFree: FriendSlotStatus | null;
  // 共通の授業・空きコマを調べるときだけ入れる（曜日・時限・科目名・教室だけ）
  schedule?: SharedCourse[];
}

export function statusAtSlot(courses: SharedCourse[], day: string, period: number): FriendSlotStatus {
  const slot = slotLabel(day, period);
  const course = courses.find((c) => c.day === day && c.period === period);
  return course ? { kind: 'class', slot, course: course.name, room: course.room } : { kind: 'free', slot };
}

function daySummary(courses: SharedCourse[], day: string, minutes: number): FriendDaySummary {
  const list = courses
    .filter((c) => c.day === day)
    .sort((a, b) => a.period - b.period)
    .map(({ period, name, room }) => ({ period, name, room }));
  if (list.length === 0) return { day, courses: [], first: null, last: null, endsAt: null, state: 'no_classes' };
  const first = list[0].period;
  const last = list[list.length - 1].period;
  const end = periodTimes(last).end;
  const state = minutes < periodTimes(first).start ? 'before' : minutes >= end ? 'finished' : 'during';
  return { day, courses: list, first, last, endsAt: clockText(end), state };
}

/** 今日のこの先（fromPeriod 以降）か、次の授業日の最初の授業 */
function findNextClass(courses: SharedCourse[], today: string, fromPeriod: number): FriendNextClass | null {
  const start = WEEK.indexOf(today);
  for (let ahead = 0; ahead < 7; ahead++) {
    const day = WEEK[(start + ahead) % 7];
    const found = courses
      .filter((c) => c.day === day && (ahead > 0 || c.period >= fromPeriod))
      .sort((a, b) => a.period - b.period)[0];
    if (found) return { day, period: found.period, slot: slotLabel(day, found.period), course: found.name, room: found.room, daysAhead: ahead };
  }
  return null;
}

/** 1人分の今・次のコマ・今日の予定・次の授業。共有を止めている人は「非公開」、時間割を送っていない人は「時間割未登録」 */
export function friendStatusAt(
  friend: { name: string; friendCode: string; share: boolean; courses: SharedCourse[] | null; presence?: FriendPresence | null },
  slot: CampusSlot
): FriendCurrentStatus {
  const base = { name: friend.name, friendCode: friend.friendCode, presence: friend.share ? friend.presence ?? null : null, today: null, nextClass: null, nextFree: null };
  if (!friend.share) return { ...base, now: { kind: 'private', slot: slot.label }, next: null };
  if (!friend.courses || friend.courses.length === 0) return { ...base, now: { kind: 'unregistered', slot: slot.label }, next: null };
  const courses = friend.courses;
  const today = daySummary(courses, slot.day, slot.minutes);
  // 授業中は次の時限から、朝・休み時間は次に始まる時限から、放課後・休日は次の授業日から探す
  const fromPeriod = slot.period === null ? 99 : slot.inClass ? slot.period + 1 : slot.period;
  const nextClass = findNextClass(courses, slot.day, fromPeriod);
  let nextFree: FriendSlotStatus | null = null;
  if (slot.period !== null && today.state !== 'finished' && today.state !== 'no_classes') {
    for (let p = fromPeriod; p <= LAST_PERIOD; p++) {
      const s = statusAtSlot(courses, slot.day, p);
      if (s.kind === 'free') {
        nextFree = s;
        break;
      }
    }
  }
  if (slot.period === null) return { ...base, now: { kind: 'off_hours', slot: slot.label }, next: null, today, nextClass, nextFree };
  return {
    ...base,
    now: statusAtSlot(courses, slot.day, slot.period),
    next: slot.next ? statusAtSlot(courses, slot.next.day, slot.next.period) : null,
    today,
    nextClass,
    nextFree
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

const nextClassBadge = (n: FriendNextClass) => `${n.daysAhead === 0 ? '本日' : n.daysAhead === 1 ? '明日' : ''}${n.slot}: ${n.room ? `${n.room}（${n.course}）` : n.course}`;

/**
 * フレンドのカードに出すバッジ。授業時間中は今と次のコマ、
 * 朝・放課後・休日は「本日1限から」「本日の授業は終了」「本日は授業なし（休日）」と次の授業
 */
export function cardBadges(s: FriendCurrentStatus, slot: CampusSlot): { main: string; mainKind: FriendStatusKind; sub: string | null } {
  if (s.now.kind === 'private' || s.now.kind === 'unregistered' || !s.today) return { main: badgeText(s.now), mainKind: s.now.kind, sub: null };
  const next = s.nextClass ? `次 ${nextClassBadge(s.nextClass)}` : null;
  if (slot.phase === 'holiday') return { main: '本日は授業なし（休日）', mainKind: 'off_hours', sub: next };
  if (slot.phase === 'after' || s.today.state === 'finished') {
    return { main: s.today.last ? `本日の授業は終了（${s.today.last}限まで）` : '本日は授業なし', mainKind: 'off_hours', sub: next };
  }
  if (s.today.state === 'no_classes') return { main: '本日は授業なし', mainKind: 'off_hours', sub: next };
  if (slot.phase === 'before') {
    const first = s.today.courses[0];
    return { main: `本日${first.period}限から${first.room ? `（${first.room}）` : ''}`, mainKind: 'off_hours', sub: null };
  }
  return { main: badgeText(s.now), mainKind: s.now.kind, sub: s.next ? `次 ${badgeText(s.next)}` : null };
}

/** フレンド一覧の見出しに出す今の区分 */
export function slotHeading(slot: CampusSlot): string {
  switch (slot.phase) {
    case 'holiday':
      return '本日は休日（授業なし）';
    case 'after':
      return '本日の授業時間は終了';
    case 'before':
      return `始業前（次は${slot.label}）`;
    case 'class':
      return `今は${slot.label}`;
    default:
      return `次は${slot.label}`;
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
const WHO_STATUS_WORDS = /(空きコマ|あきコマ|空いて|あいて|いる|一緒|いっしょ|ヒマ|ひま|暇|終わ|おわ)/;
const STATUS_WORDS = /(空き|あき|どこ|教室|いる|授業|一緒|いっしょ|何して|なにして|今|いま|予定|スケジュール|終わ|おわ|終了|次|いつ|何限|放課後|ヒマ|ひま|暇|帰|遊べ)/;

const compact = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');
// 「佐藤さんは？」「山田くんって？」のように、名前だけを聞く短い質問
const NAME_ONLY = /^.{1,12}(さん|くん|君|ちゃん)(は|って)?[?？]*$/;

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

/** フレンドの居場所・空きコマ・予定を聞いているか（「空き教室」の検索は含めない） */
export function isFriendStatusQuery(query: string, friendNames: string[] = []): boolean {
  const q = compact(query);
  if (NAME_ONLY.test(q)) return mentionedFriends(q, friendNames).length > 0;
  if (!STATUS_WORDS.test(q)) return false;
  if (FRIEND_WORDS.test(q)) return true;
  if (WHO_WORDS.test(q) && WHO_STATUS_WORDS.test(q)) return true;
  return mentionedFriends(q, friendNames).length > 0;
}

/** フレンドの名前が分からなくても、フレンドの質問かもしれないか（サーバーを呼ぶ前のふるい分け） */
export const mayBeFriendStatusQuery = (query: string) =>
  NAME_ONLY.test(compact(query)) || (STATUS_WORDS.test(compact(query)) && /(さん|くん|君|ちゃん|友|フレンド|誰|だれ)/.test(query));

/**
 * 質問の種類（ツール get_friends_current_status の引数 intent）。
 * now: 今どこ・空きコマ / next_slot: 次のコマで一緒に空きコマ / next_class: 次の授業はいつ /
 * today: 今日の予定 / finished: もう授業が終わったか / after_school: 放課後ヒマな友達
 */
export type FriendQueryIntent = 'now' | 'next_slot' | 'next_class' | 'today' | 'finished' | 'after_school' | 'common_classes' | 'common_free_periods';

const COMMON_CLASS_WORDS = /(同じ授業|共通の授業|共通授業|一緒の授業|いっしょの授業|同じ講義|共通の講義|一緒に受けて|一緒に受講|同じクラス|(かぶ|被)ってる授業|授業(が|は)?(かぶ|被|同じ|一緒|重な))/;
const COMMON_FREE_WORDS =
  /(共通の?空きコマ|一緒の空きコマ|いっしょの空きコマ|同じ空きコマ|(一緒|いっしょ|両方|二人とも|ふたりとも|共通|お互い)(に|で)?(空いて|あいて|空き|あき|ひま|暇)|空きコマ(が|は)?(かぶ|被|重な|同じ|一緒|合う|あう|そろう|揃う))/;

export function friendQueryIntent(query: string): FriendQueryIntent {
  const q = compact(query);
  if (COMMON_CLASS_WORDS.test(q)) return 'common_classes';
  // 「次のコマで一緒に空きコマの友達はいる？」は次のコマの質問
  if (COMMON_FREE_WORDS.test(q) && !/次のコマ|次の時間/.test(q)) return 'common_free_periods';
  if (/(放課後|ヒマ|ひま|暇|遊べ|帰り)/.test(q)) return 'after_school';
  if (/(予定|スケジュール|何限から|何限まで|今日の授業|今日は何)/.test(q)) return 'today';
  if (/(終わ|おわ|終了)/.test(q)) return 'finished';
  if (/次/.test(q) && !/(空き|あき|一緒|いっしょ)/.test(q) && /(授業|講義|いつ|何限|どこ)/.test(q)) return 'next_class';
  if (/次/.test(q)) return 'next_slot';
  return 'now';
}

const joinNames = (list: { name: string }[]) => list.map((f) => `${f.name}さん`).join('、');
// 「3号館201」→「3号館201教室」。すでに「室」「館」などで終わる名前はそのまま
const roomText = (room: string) => (/[0-9A-Za-zＡ-Ｚ]$/.test(room) ? `${room}教室` : room);
const where = (s: FriendSlotStatus) => (s.room ? `${s.room}で${s.course}の授業を受けています` : `${s.course}の授業を受けています`);
const isVisible = (f: FriendCurrentStatus) => f.now.kind !== 'private' && f.now.kind !== 'unregistered' && !!f.today;
const notSharedText = (f: FriendCurrentStatus) => `${f.name}さんは時間割を共有していないため分かりません。`;

/** 「次回（月曜1限）の佐藤 花子さんの授業は3号館201教室（データベース）です。」 */
function nextClassSentence(f: FriendCurrentStatus): string {
  const n = f.nextClass;
  if (!n) return `${f.name}さんの次の授業は時間割に登録されていません。`;
  const when = n.daysAhead === 0 ? `本日${n.period}限` : `次回（${n.daysAhead === 1 ? '明日・' : ''}${n.slot}）`;
  const room = n.room ? `${roomText(n.room)}（${n.course}）` : n.course;
  return n.daysAhead === 0 ? `${f.name}さんの次の授業は${when}、${room}です。` : `${when}の${f.name}さんの授業は${room}です。`;
}

/** 今日の予定の文 */
function todaySentence(f: FriendCurrentStatus, slot: CampusSlot): string {
  const t = f.today!;
  if (t.courses.length === 0) {
    return `${f.name}さんは本日（${t.day}曜）${slot.phase === 'holiday' ? '休日のため' : ''}授業がありません。${nextClassSentence(f)}`;
  }
  const list = t.courses.map((c) => `${c.period}限 ${c.name}${c.room ? `（${c.room}）` : ''}`).join('、');
  const gaps: number[] = [];
  for (let p = t.first!; p <= t.last!; p++) if (!t.courses.some((c) => c.period === p)) gaps.push(p);
  const gapText = gaps.length ? `${gaps.map((p) => `${p}限`).join('・')}は空きコマです。` : '';
  const stateText = t.state === 'finished' ? `本日の授業はすべて終わっています（${t.last}限で終了）。` : t.state === 'before' ? `まだ始まっていません。` : '';
  return `${f.name}さんの本日（${t.day}曜）の予定は、${list}です。${gapText}${stateText}`;
}

/** もう授業が終わったか */
function finishedSentence(f: FriendCurrentStatus, slot: CampusSlot): string {
  const t = f.today!;
  if (t.state === 'no_classes') return `${f.name}さんは本日${slot.phase === 'holiday' ? '休日のため' : ''}授業がありません。`;
  if (t.state === 'finished') return `はい、${f.name}さんは本日${t.last}限で全授業終了しています。`;
  const rest = t.courses.filter((c) => slot.period !== null && (slot.inClass ? c.period > slot.period : c.period >= slot.period)).length;
  const nowText = f.now.kind === 'class' ? `今は${f.now.slot}の授業中です。` : '';
  if (t.state === 'before') return `まだです。${f.name}さんは本日${t.first}限から${t.last}限（${t.endsAt}まで）授業があります。`;
  return `まだです。${f.name}さんは本日${t.last}限（${t.endsAt}まで）授業があります${rest ? `（このあと${rest}コマ）` : ''}。${nowText}`;
}

/** 授業時間外（朝・放課後・休日）に「今どこ？」と聞かれたときの1人分の文 */
function offHoursSentence(f: FriendCurrentStatus, slot: CampusSlot, withNext: boolean): string {
  const t = f.today!;
  if (slot.phase === 'holiday') return nextClassSentence(f);
  if (slot.phase === 'before') {
    if (t.state === 'no_classes') return `${f.name}さんは本日授業がありません。${withNext ? nextClassSentence(f) : ''}`;
    const first = t.courses[0];
    return `${f.name}さんは本日${first.period}限から${first.room ? `（${roomText(first.room)}）` : ''}です。`;
  }
  // 放課後
  if (t.state === 'no_classes') return `${f.name}さんは本日授業がありませんでした。${withNext ? nextClassSentence(f) : ''}`;
  return `${f.name}さんは本日${t.last}限で全授業終了です。${withNext ? nextClassSentence(f) : ''}`;
}

/** 放課後ヒマそうな友達（時間割の上で、今日の授業が終わっている・ない人） */
function afterSchoolAnswer(visible: FriendCurrentStatus[], slot: CampusSlot): string {
  if (slot.phase === 'holiday') return `本日は休日のため、どのフレンドも授業はありません（時間割の上では${joinNames(visible)}みんな空いています）。`;
  const done = visible.filter((f) => f.today!.state === 'finished');
  const none = visible.filter((f) => f.today!.state === 'no_classes');
  const busy = visible.filter((f) => f.today!.state === 'before' || f.today!.state === 'during').sort((a, b) => (a.today!.last ?? 0) - (b.today!.last ?? 0));
  const parts: string[] = [];
  if (slot.phase === 'after') parts.push('現在、本日の授業はすべて終了しています。');
  if (done.length || none.length) {
    parts.push(`時間割の上では、${[done.length ? `${joinNames(done)}は本日の授業が終わっています` : '', none.length ? `${joinNames(none)}は本日授業がありません` : ''].filter(Boolean).join('。')}。`);
  } else {
    parts.push('今の時点で本日の授業が終わっているフレンドはいません。');
  }
  if (busy.length) parts.push(`${busy.map((f) => `${f.name}さんは${f.today!.last}限（${f.today!.endsAt}）まで`).join('、')}授業があります。`);
  return parts.join('');
}

// ---- 共通の授業・共通の空きコマ（自分とフレンドの時間割を曜限ごとに比べる） ----

const WEEKDAYS = ['月', '火', '水', '木', '金'];
const ALL_PERIODS = PERIOD_TIMES.map((p) => p.period);
// 同じ曜限どうしで比べるので、カタカナの書き方の違い（ウエ／ウェ、ヴァ／バ）や中黒・長音の有無も同じとみなす
const foldKana = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/ウエ/g, 'ウェ')
    .replace(/ヴァ/g, 'バ')
    .replace(/ヴィ/g, 'ビ')
    .replace(/ヴ/g, 'ブ')
    .replace(/[・･ー\-－‐]/g, '');

/** 同じ曜限にある2つの授業が同じ授業か（表記ゆれ・ローマ数字・全角半角を無視。「情報理論」と「情報理論演習」は別） */
export function isSameSharedCourse(a: string, b: string): boolean {
  return isSameCourseName(a, b) || isSameCourseName(foldKana(a), foldKana(b));
}

export interface CommonClass {
  day: string;
  period: number;
  slot: string;
  name: string;
  room: string;
}

export interface SameSlotDifferent {
  slot: string;
  mine: string;
  theirs: string;
}

/** 同じ曜日・同じ時限に、同じ授業を登録しているコマ（days を省くと月〜土） */
export function findCommonClasses(
  mine: SharedCourse[],
  theirs: SharedCourse[],
  days: string[] = SHARE_DAYS
): { common: CommonClass[]; sameSlotDifferent: SameSlotDifferent[] } {
  const common: CommonClass[] = [];
  const sameSlotDifferent: SameSlotDifferent[] = [];
  for (const day of days) {
    const periods = [...new Set([...mine, ...theirs].filter((c) => c.day === day).map((c) => c.period))].sort((a, b) => a - b);
    for (const period of periods) {
      const a = mine.filter((c) => c.day === day && c.period === period);
      const b = theirs.filter((c) => c.day === day && c.period === period);
      if (!a.length || !b.length) continue;
      const match = a.flatMap((x) => b.filter((y) => isSameSharedCourse(x.name, y.name)).map((y) => ({ x, y })))[0];
      if (match) common.push({ day, period, slot: slotLabel(day, period), name: match.x.name, room: match.x.room || match.y.room });
      else sameSlotDifferent.push({ slot: slotLabel(day, period), mine: a[0].name, theirs: b[0].name });
    }
  }
  return { common, sameSlotDifferent };
}

/** どちらも授業を登録していない曜限（1〜5限）。曜日ごと */
export function findCommonFreePeriods(mine: SharedCourse[], theirs: SharedCourse[], days: string[]): { day: string; periods: number[] }[] {
  const busy = (list: SharedCourse[], day: string, period: number) => list.some((c) => c.day === day && c.period === period);
  return days.map((day) => ({ day, periods: ALL_PERIODS.filter((p) => !busy(mine, day, p) && !busy(theirs, day, p)) }));
}

/** 「1限と3限」「2〜5限」「1限、3限と4限」 */
function periodsText(periods: number[]): string {
  const groups: number[][] = [];
  for (const p of periods) {
    const last = groups[groups.length - 1];
    if (last && p === last[last.length - 1] + 1) last.push(p);
    else groups.push([p]);
  }
  const parts = groups.flatMap((g) => (g.length >= 3 ? [`${g[0]}〜${g[g.length - 1]}限`] : g.map((p) => `${p}限`)));
  return parts.length <= 2 ? parts.join('と') : `${parts.slice(0, -1).join('、')}と${parts[parts.length - 1]}`;
}

export type DayRange = { kind: 'today' | 'tomorrow' | 'day' | 'week'; days: string[]; label: string };

/** 質問の範囲：「今日」「明日」「水曜」、なければ今週（月〜金。土曜は聞かれたときだけ） */
export function dayRangeOf(query: string, slot: CampusSlot): DayRange {
  const q = compact(query);
  const named = q.match(/([月火水木金土])曜/);
  if (named) return { kind: 'day', days: [named[1]], label: `${named[1]}曜日` };
  if (/(今日|きょう|本日)/.test(q)) return { kind: 'today', days: SHARE_DAYS.includes(slot.day) ? [slot.day] : [], label: `本日（${slot.day}曜日）` };
  if (/(明日|あした|あす)/.test(q)) {
    const day = WEEK[(WEEK.indexOf(slot.day) + 1) % 7];
    return { kind: 'tomorrow', days: SHARE_DAYS.includes(day) ? [day] : [], label: `明日（${day}曜日）` };
  }
  return { kind: 'week', days: WEEKDAYS, label: '今週' };
}

/** 共通の授業の答え（range を指定したら、その日だけ） */
function commonClassesSentence(f: FriendCurrentStatus, mine: SharedCourse[], range: DayRange | null): string {
  const theirs = f.schedule || [];
  const days = range ? range.days : SHARE_DAYS;
  const where = range ? `${range.label}に` : '';
  const { common, sameSlotDifferent } = findCommonClasses(mine, theirs, days);
  if (common.length === 0) {
    const note = sameSlotDifferent.length
      ? `なお、${sameSlotDifferent.map((d) => `${d.slot}はどちらも授業がありますが、あなたは『${d.mine}』、${f.name}さんは『${d.theirs}』で別の授業です`).join('。')}。`
      : '';
    return `${f.name}さんと${where}同じ曜限に受講している共通の授業はありません。${note}`;
  }
  const list = common.map((c) => `${c.slot}の『${c.name}』${c.room ? `（${roomText(c.room)}）` : ''}`).join('と、');
  return `${f.name}さんと${where}共通で受講している授業は、${list}です。`;
}

/** 共通の空きコマの答え */
function commonFreeSentence(f: FriendCurrentStatus, mine: SharedCourse[], range: DayRange): string {
  const theirs = f.schedule || [];
  if (range.days.length === 0) return `${range.label}は休日のため授業はありません。`;
  const result = findCommonFreePeriods(mine, theirs, range.days);
  if (range.kind !== 'week') {
    const periods = result[0].periods;
    const lead = range.kind === 'day' ? range.label : range.label.replace(/（.*）$/, '');
    if (periods.length === 0) return `${lead}、${f.name}さんと時間が被る共通の空きコマはありません。`;
    const allDay = periods.length === ALL_PERIODS.length ? '（どちらも授業がない日です）' : '';
    return `${range.label}の${f.name}さんとの共通空きコマは${periodsText(periods)}です${allDay}。学食やラウンジで合流できます！`;
  }
  const withFree = result.filter((r) => r.periods.length > 0);
  const none = result.filter((r) => r.periods.length === 0);
  if (withFree.length === 0) return `今週（月〜金）、${f.name}さんと時間が被る共通の空きコマはありません。`;
  const list = withFree.map((r) => `${r.day}曜 ${r.periods.length === ALL_PERIODS.length ? '終日' : periodsText(r.periods)}`).join('、');
  const noneText = none.length ? `${none.map((r) => `${r.day}曜`).join('と')}は共通の空きコマがありません。` : '';
  return `今週の${f.name}さんとの共通空きコマは、${list}です。${noneText}`;
}

/** 共通の授業・空きコマの質問の答え（myCourses は質問した本人の今期の時間割） */
function answerCommonQuery(
  query: string,
  intent: 'common_classes' | 'common_free_periods',
  slot: CampusSlot,
  targets: FriendCurrentStatus[],
  myCourses: SharedCourse[]
): string {
  if (myCourses.length === 0) {
    return 'あなたの今期の時間割が登録されていないため、比べられません。プロフィールの「今期履修中」に時間割を登録するか、時間割の画像を送ってください。';
  }
  const hasRange = /([月火水木金土])曜|今日|きょう|本日|明日|あした|あす/.test(compact(query));
  const range = dayRangeOf(query, slot);
  return targets
    .map((f) => {
      if (f.now.kind === 'private' || f.now.kind === 'unregistered' || !f.schedule) return notSharedText(f);
      return intent === 'common_classes' ? commonClassesSentence(f, myCourses, hasRange ? range : null) : commonFreeSentence(f, myCourses, range);
    })
    .join('\n');
}

/**
 * get_friends_current_status の結果からチャットの答えを作る（AIに推測させない）。
 * myCourses は質問した本人の時間割（「次のコマで一緒に空きコマ」の判定に使う）
 */
export function answerFriendStatusQuery(
  query: string,
  result: FriendsStatusResult,
  myCourses: SharedCourse[] = [],
  intent: FriendQueryIntent = friendQueryIntent(query)
): string {
  const { slot, friends } = result;
  if (friends.length === 0) {
    return 'まだフレンドがいません。プロフィールの「フレンド」タブで、友達のフレンドコードを入力して申請してください。';
  }
  const named = mentionedFriends(query, friends.map((f) => f.name));
  const targets = named.length ? friends.filter((f) => named.includes(f.name)) : friends;
  const visible = targets.filter(isVisible);
  const hidden = targets.filter((f) => !isVisible(f));
  const hiddenNote = hidden.length ? `${joinNames(hidden)}は時間割を共有していないため分かりません。` : '';
  const offHours = slot.phase === 'after' || slot.phase === 'holiday';
  const lead = slot.phase === 'holiday' ? '本日は休日のため授業はありません。' : slot.phase === 'after' ? '現在、本日の授業はすべて終了しています。' : '';

  if (intent === 'common_classes' || intent === 'common_free_periods') return answerCommonQuery(query, intent, slot, targets, myCourses);
  if (named.length && visible.length === 0) return hidden.map(notSharedText).join('\n');

  // 時間帯を問わない質問：今日の予定・もう終わった？・次の授業・放課後
  if (intent === 'today') return [...visible.map((f) => todaySentence(f, slot)), hiddenNote].filter(Boolean).join('\n');
  if (intent === 'finished') return [lead && !named.length ? lead : '', ...visible.map((f) => finishedSentence(f, slot)), hiddenNote].filter(Boolean).join('\n');
  if (intent === 'next_class') return [...visible.map(nextClassSentence), hiddenNote].filter(Boolean).join('\n');
  if (intent === 'after_school') return afterSchoolAnswer(visible, slot) + hiddenNote;

  // 朝・放課後・休日の「今どこ？」「空きコマ？」
  if (offHours || slot.phase === 'before') {
    if (intent === 'next_slot' && slot.phase !== 'before') {
      return `${lead || '今日はこのあと授業のコマがありません。'}${visible.map(nextClassSentence).join('')}${hiddenNote}`;
    }
    if (intent !== 'next_slot') {
      const head = slot.phase === 'before' ? `今は始業前です（1限は${PERIOD_TIMES[0].label.split('〜')[0]}から）。` : lead;
      return head + visible.map((f) => offHoursSentence(f, slot, named.length > 0)).join('') + hiddenNote;
    }
  }

  const when = `${slot.inClass ? '現在' : '次の授業'}（${slot.label}）`;

  // 次のコマで一緒に空きコマ（授業中は次の時限、休み時間・朝は次に始まる時限）
  if (intent === 'next_slot') {
    const target = slot.inClass ? slot.next : { day: slot.day, period: slot.period!, label: slot.label };
    if (!target) return `今日はこのあと授業のコマがありません（${slot.label}が最後です）。${hiddenNote}`;
    const statusAt = (f: FriendCurrentStatus) => (slot.inClass ? f.next : f.now);
    const freeNext = visible.filter((f) => statusAt(f)?.kind === 'free');
    const meBusy = myCourses.find((c) => c.day === target.day && c.period === target.period);
    const mine = meBusy ? `あなたは${target.label}に${meBusy.name}があります。` : `あなたも${target.label}は空きコマです。`;
    if (freeNext.length === 0) return `${target.label}に空きコマのフレンドはいません。${mine}${hiddenNote}`;
    return `${target.label}は、${joinNames(freeNext)}が空きコマです。${mine}${meBusy ? '' : '一緒に過ごせますね。'}${hiddenNote}`;
  }

  // 名前を指定した「今どこ？」
  if (named.length) {
    return [
      ...visible.map((f) => {
        const t = f.today!;
        if (t.state === 'finished') return `${f.name}さんは本日${t.last}限で全授業終了しています。${nextClassSentence(f)}`;
        if (t.state === 'no_classes') return `${f.name}さんは本日授業がありません。${nextClassSentence(f)}`;
        if (f.now.kind === 'class') {
          const next = f.next ? (f.next.kind === 'class' ? `その次（${f.next.slot}）は${f.next.room || f.next.course}です。` : `その次（${f.next.slot}）は空きコマです。`) : '';
          return `${when}、${f.name}さんは${where(f.now)}。${next}`;
        }
        const later = t.state === 'before' ? `本日は${t.first}限からです。` : f.next ? (f.next.kind === 'class' ? `その次（${f.next.slot}）は${f.next.room || f.next.course}です。` : `その次（${f.next.slot}）も空きコマです。`) : '';
        return `${when}、${f.name}さんは空きコマです。${later}`;
      }),
      hiddenNote
    ]
      .filter(Boolean)
      .join('\n');
  }

  const free = visible.filter((f) => f.now.kind === 'free');
  const inClass = visible.filter((f) => f.now.kind === 'class');
  const parts: string[] = [];
  parts.push(free.length ? `${when}、${joinNames(free)}が空きコマです。` : `${when}、空きコマのフレンドはいません。`);
  if (inClass.length) parts.push(`${free.length ? 'また、' : ''}${inClass.map((f) => `${f.name}さんは${where(f.now)}`).join('、')}。`);
  if (hiddenNote) parts.push(hiddenNote);
  return parts.join('');
}
