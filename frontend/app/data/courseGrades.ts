// 成績の評価・修得判定・再履修の整理（学部要覧 p.38-39 準拠）
// S/A/B/C は合格、D/E/F は不合格（単位未修得）。P は履修中止で未修得・GPA算定外、N は認定で修得・GPA算定外。
import type { CourseRecord } from './gakubuYoran';

const GRADE_ALIASES: Record<string, string> = {
  S: 'S', 秀: 'S',
  A: 'A', 優: 'A',
  B: 'B', 良: 'B',
  C: 'C', 可: 'C',
  D: 'D', 不可: 'D',
  E: 'E',
  F: 'F', 不合格: 'F',
  P: 'P', 履修中止: 'P', 中止: 'P',
  N: 'N', 認定: 'N', 認: 'N',
  合格: '合格', 合: '合格', PASS: '合格',
  免除: '免除', 免: '免除',
  修得: '修得', 履修済: '修得',
  '-': '-', '－': '-', 'ー': '-', '': '-'
};

const GRADE_POINTS: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, D: 0, E: 0, F: 0 };
const FAILING_GRADES = new Set(['D', 'E', 'F']);

/** 表記ゆれ（秀/優/良/可/不可、全角、小文字、括弧付き）を S/A/B/C/D/E/F などにそろえる */
export function normalizeGrade(raw: unknown): string {
  const text = String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/^[(\[【「『]\s*(.*?)\s*[)\]】」』]$/, '$1')
    .toUpperCase();
  return GRADE_ALIASES[text] ?? text;
}

/** D/E/F（不合格）なら true */
export function isFailingGrade(grade: unknown): boolean {
  return FAILING_GRADES.has(normalizeGrade(grade));
}

/** 単位を修得した記録なら true。不合格と履修中止は修得にならない。評価なし（過去の時間割から登録）は修得扱い */
export function isEarnedGrade(grade: unknown): boolean {
  const g = normalizeGrade(grade);
  return !FAILING_GRADES.has(g) && g !== 'P';
}

/** GPAの点数。GPA算定外（P/N/合格/修得など）は null */
export function gradePoint(grade: unknown): number | null {
  const g = normalizeGrade(grade);
  return g in GRADE_POINTS ? GRADE_POINTS[g] : null;
}

/** 同じ科目かどうかの判定に使うキー（全角半角・空白の違いを無視する） */
export function courseKey(name: string): string {
  return String(name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

const TERM_ORDER: Record<string, number> = { 前期: 1, 春学期: 1, 夏期: 2, 集中: 2, 後期: 3, 秋学期: 3, 通年: 3 };

function attemptTime(c: CourseRecord): number | null {
  if (!c.takenYear) return null;
  return c.takenYear * 10 + (TERM_ORDER[String(c.term || '').trim()] ?? 0);
}

/** 同名科目の2つの記録から最後の履修を選ぶ */
function laterAttempt(prev: CourseRecord, next: CourseRecord): CourseRecord {
  const prevTime = attemptTime(prev);
  const nextTime = attemptTime(next);
  if (prevTime !== null && nextTime !== null && prevTime !== nextTime) {
    return nextTime > prevTime ? next : prev;
  }
  // 年度が分からないとき：修得済みの科目は再履修できないので、合格した記録が最後の履修
  const prevEarned = isEarnedGrade(prev.grade);
  const nextEarned = isEarnedGrade(next.grade);
  if (prevEarned !== nextEarned) return nextEarned ? next : prev;
  // どちらも合格、またはどちらも不合格なら後から読み込んだ方（成績表は古い順に並ぶ）
  return next;
}

export interface RetakeResolution {
  courses: CourseRecord[];
  /** 再履修などで除外した古い記録 */
  replaced: CourseRecord[];
}

/**
 * 同名科目を1件にまとめ、最後の履修の成績と単位数だけを残す（要覧 p.39 の再履修規定）。
 * records は古い順（既存の記録→新しく読み込んだ記録、成績表の上→下）に渡す。
 */
export function resolveRetakes(records: CourseRecord[]): RetakeResolution {
  const byKey = new Map<string, CourseRecord>();
  const replaced: CourseRecord[] = [];
  for (const record of records) {
    const key = courseKey(record.name);
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, record);
      continue;
    }
    const winner = laterAttempt(prev, record);
    replaced.push(winner === record ? prev : record);
    // 最初に出てきた位置のまま中身だけ差し替える
    byKey.set(key, winner);
  }
  return { courses: Array.from(byKey.values()), replaced };
}

/** 修得単位数の合計（不合格・履修中止を除く） */
export function sumEarnedCredits(courses: CourseRecord[]): number {
  return courses.reduce((sum, c) => sum + (isEarnedGrade(c.grade) ? Number(c.credits) || 0 : 0), 0);
}

/** 累積GPA。D/E/F の単位は分母に含め、P/N/合格などは除く。対象科目がなければ null */
export function calculateGpa(courses: CourseRecord[]): number | null {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    const pt = gradePoint(c.grade);
    const cr = Number(c.credits) || 0;
    if (pt === null || cr <= 0) continue;
    points += pt * cr;
    credits += cr;
  }
  return credits > 0 ? Math.round((points / credits) * 100) / 100 : null;
}

/** AIやテキストから来た科目データを CourseRecord にそろえる。科目名・単位数・評価の3つは必ず持たせる */
export function toCourseRecord(raw: any, fallbackGrade = '-'): CourseRecord | null {
  const name = String(raw?.name ?? '').trim();
  if (!name) return null;
  const credits = Number(raw?.credits);
  const grade = normalizeGrade(raw?.grade ?? fallbackGrade);
  const rawYear = Number(raw?.year);
  // year に年度（2025など）が入っていたら履修年度として扱う
  const takenYear = Number(raw?.takenYear ?? raw?.academicYear ?? (rawYear >= 2000 ? rawYear : NaN));
  const term = String(raw?.term ?? raw?.semester ?? '').trim();
  const record: CourseRecord = {
    name,
    credits: Number.isFinite(credits) && credits > 0 ? credits : 2,
    grade: grade === '-' ? normalizeGrade(fallbackGrade) : grade,
    year: rawYear >= 1 && rawYear <= 6 ? rawYear : 1
  };
  if (Number.isInteger(takenYear) && takenYear >= 2000 && takenYear <= 2100) record.takenYear = takenYear;
  if (term) record.term = term;
  if (raw?.category) record.category = String(raw.category);
  return record;
}
