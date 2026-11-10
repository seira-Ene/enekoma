// 講義の時間 × 位置情報（校内にいたか）による自動出欠。記録はこの端末の中だけに保存し、フレンドやサーバーには送らない。
// ブラウザは EneKoma を開いている間しか位置情報を取れないため、授業の時間に一度も位置を確かめられなかった回は「未確認」にする
import { getCampusClock, PERIOD_TIMES } from './courses';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'unconfirmed' | 'cancelled';

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: '出席',
  late: '遅刻',
  absent: '欠席',
  unconfirmed: '未確認',
  cancelled: '休講'
};

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD（日本時間）
  day: string;
  period: number;
  course: string;
  status: AttendanceStatus;
  source: 'auto' | 'manual';
  updatedAt: number;
}

/** 位置情報で確かめた「校内にいたか」（緯度・経度は残さない） */
export interface CampusObservation {
  t: number;
  on: boolean;
}

const MIN = 60 * 1000;
// 判定の基準（分）。開始30分前から開始15分後までに校内なら出席、30分後までなら遅刻
export const ATTENDANCE_RULES = { earlyWindowMin: 30, presentUntilMin: 15, lateUntilMin: 30 };

/**
 * 1回の授業の出欠。まだ決められなければ null。
 * - 出席: 開始30分前〜開始15分後に校内
 * - 遅刻: 開始15分後〜30分後に初めて校内
 * - 欠席: 開始30分後を過ぎても校外のまま（授業が始まってから校外と確認できた）、または授業の終わりまで校内と確認できなかった
 * - 未確認: 授業の時間に一度も位置を確かめられなかった（アプリを開いていなかった）
 */
export function evaluateClass(startMs: number, endMs: number, observations: CampusObservation[], nowMs: number): AttendanceStatus | null {
  const { earlyWindowMin, presentUntilMin, lateUntilMin } = ATTENDANCE_RULES;
  const windowStart = startMs - earlyWindowMin * MIN;
  const inWindow = observations.filter((o) => o.t >= windowStart && o.t <= Math.min(endMs, nowMs));
  const firstOn = inWindow.filter((o) => o.on).reduce<number | null>((min, o) => (min === null || o.t < min ? o.t : min), null);
  if (firstOn !== null) {
    if (firstOn <= startMs + presentUntilMin * MIN) return 'present';
    if (firstOn <= startMs + lateUntilMin * MIN) return 'late';
    return 'absent';
  }
  if (nowMs < startMs + lateUntilMin * MIN) return null;
  if (inWindow.some((o) => !o.on && o.t >= startMs)) return 'absent';
  if (nowMs < endMs) return null;
  return inWindow.length > 0 ? 'absent' : 'unconfirmed';
}

/** 日本時間の日付（YYYY-MM-DD） */
export function campusDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** その日のその時限の開始・終了（ミリ秒） */
export function periodRange(date: string, period: number): { startMs: number; endMs: number } | null {
  const p = PERIOD_TIMES.find((x) => x.period === period);
  if (!p) return null;
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  return { startMs: midnight + p.start * MIN, endMs: midnight + p.end * MIN };
}

export const recordKey = (r: { date: string; period: number; course: string }) => `${r.date}|${r.period}|${r.course}`;

/**
 * 今日の授業の出欠を、位置情報の記録から決める。手で直した記録は書き換えない。
 * 変わった記録だけを返す
 */
export function autoAttendanceUpdates(
  courses: { day?: string; period?: number | string; name: string }[],
  observations: CampusObservation[],
  existing: Record<string, AttendanceRecord>,
  now: Date = new Date()
): AttendanceRecord[] {
  const clock = getCampusClock(now);
  const date = campusDate(now);
  const updates: AttendanceRecord[] = [];
  const seen = new Set<string>();
  for (const c of courses) {
    const day = String(c.day || '').replace(/曜.*$/, '');
    const period = Number(c.period);
    if (day !== clock.day || !Number.isInteger(period) || !c.name) continue;
    const range = periodRange(date, period);
    if (!range) continue;
    const key = recordKey({ date, period, course: c.name });
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = existing[key];
    if (prev?.source === 'manual') continue;
    const status = evaluateClass(range.startMs, range.endMs, observations, now.getTime());
    if (!status || prev?.status === status) continue;
    updates.push({ date, day, period, course: c.name, status, source: 'auto', updatedAt: now.getTime() });
  }
  return updates;
}

/** 科目ごとの累計（休講と未確認は出席・遅刻・欠席に数えない） */
export function attendanceCounts(records: AttendanceRecord[], course: string): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0, unconfirmed: 0, cancelled: 0 };
  for (const r of records) if (r.course === course) counts[r.status]++;
  return counts;
}

// ---- 端末への保存 ----
const recordsKey = (accountId: string) => `enekoma_attendance:${accountId}`;
const OBSERVATION_KEY = 'enekoma_campus_log';
const OBSERVATION_KEEP_MS = 36 * 60 * MIN;
const OBSERVATION_MIN_GAP_MS = MIN;
const OBSERVATION_MAX = 1000;

/**
 * 原因調査用のログ（[Attendance]）。開発中（next dev）と、
 * 本番でも localStorage に enekoma_debug_attendance=1 を入れた端末だけ出す
 */
export function attendanceLog(message: string, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  let enabled = process.env.NODE_ENV !== 'production';
  try {
    enabled = enabled || localStorage.getItem('enekoma_debug_attendance') === '1';
  } catch {
    // 読めなければ開発中だけ出す
  }
  if (!enabled) return;
  if (detail === undefined) console.info(`[Attendance] ${message}`);
  else console.info(`[Attendance] ${message}`, detail);
}

export function readAttendance(accountId: string): Record<string, AttendanceRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(recordsKey(accountId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAttendance(accountId: string, records: Record<string, AttendanceRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(recordsKey(accountId), JSON.stringify(records));
  } catch {
    // 保存できないときは何もしない
  }
}

export function readObservations(now: number = Date.now()): CampusObservation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OBSERVATION_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((o) => typeof o?.t === 'number' && now - o.t < OBSERVATION_KEEP_MS) : [];
  } catch {
    return [];
  }
}

/**
 * 校内か校外かの記録を足す（変わったときと、前の記録から1分以上たったとき。古いものは消す）。
 * 以前は同じ判定を5分ごとにしか残さなかったため、授業の直前に開いた測位が落ち、授業中に一度開いても「未確認」になることがあった
 */
export function addObservation(on: boolean, now: number = Date.now()): CampusObservation[] {
  const list = readObservations(now);
  const last = list[list.length - 1];
  if (!last || last.on !== on || now - last.t >= OBSERVATION_MIN_GAP_MS) list.push({ t: now, on });
  try {
    localStorage.setItem(OBSERVATION_KEY, JSON.stringify(list.slice(-OBSERVATION_MAX)));
  } catch {
    // 保存できなくても判定は続ける
  }
  return list;
}
