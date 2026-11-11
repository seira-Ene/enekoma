// 日本大学文理学部 講義データベース（検索・ワンタップ登録用）
import timetableReiwa8 from './timetableReiwa8.json';
import timetableReiwa8Legacy from './timetableReiwa8Legacy.json';

export interface LectureCourse {
  day: string; // "月", "火", "水", "木", "金", "土", "集中"
  period: number; // 1〜5, 集中は0
  name: string;
  teacher: string;
  room: string;
  department: string;
  type?: '必修' | '選択必修' | '選択';
  semester?: string;
  grade?: string;
  curriculum?: string;
  targets?: string[]; // クラス指定の学科
  group?: string; // 組やクラス指定の表記
  schedule?: string; // 集中授業の日程、遠隔授業の履修登録方法
  place?: string; // 集中授業の場所
}

/**
 * 教室番号から表示エリア（最大12文字以内）に収まるコンパクト表記を生成
 * 例: 3403 -> 3号館403(男子側), 411 -> 4号館411(男子側), 8B203/8B210 -> 8B203他
 */
export function getCompactRoomLabel(room: string | undefined): string {
  if (!room) return '未定';
  const r = room.trim().replace(/88203/g, '8B203').replace(/88210/g, '8B210');

  // 複合教室表記の短縮（例: 8B203/8B210, 3409／3408／3304）
  if (r.includes('／') || r.includes('/')) {
    const first = r.split(/[／/]/)[0].trim();
    return `${getCompactRoomLabel(first)}他`;
  }

  // 8号館 (8B203, 8B210, 8AB, 8号館資料館)
  if (r.startsWith('8B') || r.startsWith('8A')) {
    return `8号館${r}`;
  }

  // 3号館: 4桁（3〇〇〇）※番号を省略せず「3号館3306(女子側)」とする
  if (/^3\d{3}$/.test(r)) {
    const sub = parseInt(r.slice(2), 10);
    const side = (sub >= 1 && sub <= 5) ? '男子側' : (sub >= 6 && sub <= 10 ? '女子側' : '');
    return side ? `3号館${r}(${side})` : `3号館${r}`;
  }

  // 4号館: 3桁（4〇〇）
  if (/^4\d{2}$/.test(r)) {
    const sub = r.slice(1);
    let side = '';
    if (['11', '21', '31', '41'].includes(sub)) side = '男子側';
    else if (['12', '22', '32', '42'].includes(sub)) side = '女子側';
    return side ? `4号館${r}(${side})` : `4号館${r}`;
  }

  // 1号館: 3桁（1〇〇）
  if (/^1\d{2}[A-Za-z]?$/.test(r)) {
    let side = '';
    if (['122', '123', '124', '131', '132', '133', '134'].includes(r)) side = '左';
    else if (['125', '126', '127A', '127B', '135', '136', '137A', '137B'].includes(r)) side = '右';
    else if (r === '130') side = '正面';
    return side ? `1号館${r}(${side})` : `1号館${r}`;
  }

  // 2号館: 4桁（2〇〇〇）※番号を省略せず「2号館2301」とする
  if (/^2\d{3}$/.test(r)) {
    return `2号館${r}`;
  }

  // 特殊教室の短縮
  if (r.includes('学芸員')) return '学芸員演習室';
  if (r.includes('情報分析')) return '情報分析室';
  if (r.includes('遠隔')) return '遠隔授業';
  if (r.includes('研究室')) return '各教員研究室';
  if (r.includes('第1学生実験室')) return '第1実験室';
  if (r.includes('第2学生実験室')) return '第2実験室';
  if (r.includes('第3・4学生実験室')) return '第3・4実験室';
  if (r.includes('1・2年実験室')) return '1・2年実験室';
  if (r.includes('生命科')) return '生命科実験室';

  if (r.length > 12) {
    return r.slice(0, 11) + '…';
  }

  return r;
}

// =========================================================================
// 講義データベース取得（入学年度・カリキュラム体系連動）
// =========================================================================
const TIMETABLE_REIWA8 = timetableReiwa8.courses as LectureCourse[];
const TIMETABLE_REIWA8_LEGACY = timetableReiwa8Legacy.courses as LectureCourse[];

export function getLectureDatabase(curriculum?: string): LectureCourse[] {
  return curriculum === 'reiwa6_or_earlier' ? TIMETABLE_REIWA8_LEGACY : TIMETABLE_REIWA8;
}

// 教室の使用状況は入学年度に関係なく、全カリキュラムの授業を合わせて判定する
const ALL_WEEKLY_CLASSES: LectureCourse[] = [...TIMETABLE_REIWA8, ...TIMETABLE_REIWA8_LEGACY].filter((c) => c.period > 0);

// =========================================================================
// 学内時刻・学期（サーバーのタイムゾーンに依存しないよう日本時間で計算）
// =========================================================================
export type Semester = '前期' | '後期';

export const PERIOD_TIMES: { period: number; start: number; end: number; label: string }[] = [
  { period: 1, start: 9 * 60, end: 10 * 60 + 30, label: '09:00〜10:30' },
  { period: 2, start: 10 * 60 + 40, end: 12 * 60 + 10, label: '10:40〜12:10' },
  { period: 3, start: 13 * 60, end: 14 * 60 + 30, label: '13:00〜14:30' },
  { period: 4, start: 14 * 60 + 40, end: 16 * 60 + 10, label: '14:40〜16:10' },
  { period: 5, start: 16 * 60 + 20, end: 17 * 60 + 50, label: '16:20〜17:50' }
];

export interface CampusClock {
  month: number;
  date: number;
  day: string;
  minutes: number;
  semester: Semester;
  label: string;
}

export function getCampusClock(now: Date = new Date()): CampusClock {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(now);
  const read = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  const month = parseInt(read('month'), 10);
  const date = parseInt(read('day'), 10);
  const hour = parseInt(read('hour'), 10);
  const minute = parseInt(read('minute'), 10);
  const day = read('weekday');
  return {
    month,
    date,
    day,
    minutes: hour * 60 + minute,
    semester: month >= 4 && month <= 9 ? '前期' : '後期',
    label: `${month}月${date}日(${day}) ${hour}時${String(minute).padStart(2, '0')}分`
  };
}

export type SlotStatus = 'before' | 'class' | 'break' | 'lunch' | 'after';

// 指定時刻の時限を返す。授業の合間は次の時限を返す
export function resolvePeriodAt(minutes: number): { period: number | null; status: SlotStatus } {
  if (minutes < PERIOD_TIMES[0].start) return { period: 1, status: 'before' };
  for (const slot of PERIOD_TIMES) {
    if (minutes >= slot.start && minutes < slot.end) return { period: slot.period, status: 'class' };
    if (minutes < slot.start) {
      return { period: slot.period, status: slot.period === 3 ? 'lunch' : 'break' };
    }
  }
  return { period: null, status: 'after' };
}

export function isInSemester(course: LectureCourse, semester?: Semester): boolean {
  if (!semester || !course.semester) return true;
  if (course.semester.includes('通年')) return true;
  return course.semester.includes(semester[0]);
}

// =========================================================================
// 教室の判定
// =========================================================================
const GENERAL_ROOM_PATTERN = /^(1\d{2}[AB]?|2[2-6]\d{2}|3\d{3}|4\d{2}|7\d{3})$/;

export function normalizeRoom(room: string): string {
  return room.normalize('NFKC').trim().toUpperCase().replace(/^88(\d{3})$/, '8B$1');
}

export function splitRooms(room: string | undefined): string[] {
  return (room || '').split(/[/／,、\s]+/).map(normalizeRoom).filter(Boolean);
}

// 実際に授業で使われている一般講義室をマスターとする（実験室・PC教室・体育施設は自習先に案内しない）
export const ALL_CAMPUS_ROOMS: string[] = Array.from(
  new Set(TIMETABLE_REIWA8.flatMap((c) => (c.period > 0 ? splitRooms(c.room) : [])).filter((r) => GENERAL_ROOM_PATTERN.test(r)))
).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));

export function isKnownRoom(room: string): boolean {
  const target = normalizeRoom(room);
  return ALL_CAMPUS_ROOMS.includes(target) || ALL_WEEKLY_CLASSES.some((c) => splitRooms(c.room).includes(target));
}

export function findRoomUsage(room: string, day: string, period: number, semester: Semester): LectureCourse[] {
  const target = normalizeRoom(room);
  return ALL_WEEKLY_CLASSES.filter(
    (c) => c.day === day && c.period === period && isInSemester(c, semester) && splitRooms(c.room).includes(target)
  );
}

function buildingOf(room: string): string {
  if (room.startsWith('1')) return '1号館';
  if (room.startsWith('2')) return '2号館';
  if (room.startsWith('3')) return '3号館';
  if (room.startsWith('4')) return '4号館';
  if (room.startsWith('7')) return '7号館';
  return '他';
}

// =========================================================================
// 1. リアルタイム空き教室・自習スポット検索
// =========================================================================
export interface FreeRoomsResult {
  day: string;
  period: number;
  semester: Semester;
  isLunchBreak: boolean;
  isOutOfHours: boolean;
  totalFreeCount: number;
  freeRooms: string[];
  byBuilding: { [bld: string]: string[] };
  formattedReport: string;
}

function freeRoomsAt(day: string, period: number, semester: Semester): string[] {
  const occupied = new Set<string>();
  ALL_WEEKLY_CLASSES.forEach((c) => {
    if (c.day === day && c.period === period && isInSemester(c, semester)) {
      splitRooms(c.room).forEach((r) => occupied.add(r));
    }
  });
  return ALL_CAMPUS_ROOMS.filter((r) => !occupied.has(r));
}

function groupByBuilding(rooms: string[]): { [bld: string]: string[] } {
  const grouped: { [bld: string]: string[] } = { '1号館': [], '2号館': [], '3号館': [], '4号館': [], '7号館': [] };
  rooms.forEach((r) => grouped[buildingOf(r)]?.push(r));
  return grouped;
}

const STUDY_SPOT_NOTE = '静かに自習やPC作業をしたいときは、本館1階のラーニング・コモンズや図書館を利用するのもおすすめです！';
const DATA_NOTE = '時間割をもとにした判定なので、休講や補講、教室変更、大学の行事があるときは実際と異なる場合があります。';

export function findFreeRooms(
  targetDay?: string,
  targetPeriod?: number,
  targetBuilding?: string,
  semester?: Semester,
  now: Date = new Date()
): FreeRoomsResult {
  const clock = getCampusClock(now);
  const term = semester || clock.semester;
  const day = targetDay || clock.day;
  const usesCurrentTime = targetDay === undefined && targetPeriod === undefined;
  const resolved = resolvePeriodAt(clock.minutes);
  const isLunch = usesCurrentTime && resolved.status === 'lunch';

  const emptyResult = (report: string, period: number): FreeRoomsResult => ({
    day,
    period,
    semester: term,
    isLunchBreak: false,
    isOutOfHours: true,
    totalFreeCount: 0,
    freeRooms: [],
    byBuilding: groupByBuilding([]),
    formattedReport: report
  });

  if (day === '日') {
    return emptyResult('日曜日は授業がないので、教室の空き状況はお出しできません。「月曜2限の空き教室は？」のように曜日と時限を指定してもらえれば、すぐにお調べしますよ。', 0);
  }
  if (usesCurrentTime && resolved.period === null) {
    return emptyResult('今日の授業時間（5限は17時50分まで）は終わっています。「明日の2限の空き教室は？」のように指定してもらえれば、すぐにお調べしますよ。', 0);
  }

  // 曜日だけの指定は時限ごとの空き状況を返す
  if (targetDay !== undefined && targetPeriod === undefined) {
    const lines = [`${term}の${day}曜日の空き教室を時限ごとにお調べしました！`, ''];
    PERIOD_TIMES.forEach((slot) => {
      const rooms = freeRoomsAt(day, slot.period, term).filter((r) => !targetBuilding || buildingOf(r) === targetBuilding);
      const sample = rooms.slice(0, 5).map(getCompactRoomLabel).join('、');
      lines.push(rooms.length > 0 ? `${slot.period}限は${rooms.length}室が空いていて、${sample}などが使えますよ。` : `${slot.period}限は空いている教室がありませんでした。`);
    });
    lines.push('', DATA_NOTE);
    const firstPeriod = PERIOD_TIMES[0].period;
    const rooms = freeRoomsAt(day, firstPeriod, term);
    return {
      day,
      period: firstPeriod,
      semester: term,
      isLunchBreak: false,
      isOutOfHours: false,
      totalFreeCount: rooms.length,
      freeRooms: rooms,
      byBuilding: groupByBuilding(rooms),
      formattedReport: lines.join('\n')
    };
  }

  const period = targetPeriod ?? (resolved.period as number);
  // 昼休みは授業がないので全教室が対象
  const freeRooms = isLunch ? ALL_CAMPUS_ROOMS : freeRoomsAt(day, period, term);
  const byBuilding = groupByBuilding(freeRooms);
  const timeLabel = PERIOD_TIMES.find((p) => p.period === period)?.label || '';

  const lines: string[] = [];
  if (isLunch) {
    lines.push('今はお昼休み（12時10分から13時）ですね！');
    lines.push('');
    lines.push('お昼休みは全教室が開放されていて、休憩や昼食、自習に使えますよ。飲食した後のゴミは持ち帰るようにして、3限の受講生が入ってきたら席を譲るようにしてくださいね。');
  } else {
    const heading = usesCurrentTime && resolved.status !== 'class'
      ? `次の${day}曜日${period}限（${timeLabel}）に使える空き教室をお調べしました！`
      : `${term}の${day}曜日${period}限（${timeLabel}）に使える空き教室をお調べしました！`;
    lines.push(heading);
  }
  lines.push('');

  if (targetBuilding) {
    const rooms = byBuilding[targetBuilding] || [];
    lines.push(rooms.length > 0
      ? `${targetBuilding}では ${rooms.slice(0, 12).map(getCompactRoomLabel).join('、')} が利用できますよ（全${rooms.length}室）。`
      : `${targetBuilding}には空いている教室がありませんでした。`);
  } else if (freeRooms.length === 0) {
    lines.push('このコマに空いている一般教室はありませんでした。');
  } else {
    const summary = ['3号館', '4号館', '1号館', '2号館', '7号館']
      .filter((b) => byBuilding[b].length > 0)
      .map((b) => `${b}は ${byBuilding[b].slice(0, 5).map(getCompactRoomLabel).join('、')} など`)
      .join('、');
    lines.push(`${summary}、キャンパス全体で合計${freeRooms.length}室が空いていますよ。`);
  }
  lines.push('');
  lines.push(STUDY_SPOT_NOTE);
  lines.push(DATA_NOTE);

  return {
    day,
    period,
    semester: term,
    isLunchBreak: isLunch,
    isOutOfHours: false,
    totalFreeCount: freeRooms.length,
    freeRooms,
    byBuilding,
    formattedReport: lines.join('\n')
  };
}

// =========================================================================
// 科目名の照合と受講資格
// =========================================================================
export interface StudentContext {
  department?: string;
  grade?: number;
  semester?: Semester;
  takenCourses?: string[];
}

/**
 * 科目名の後ろのローマ数字（Ⅰ・Ⅱ・III など）を算用数字にする。時間割は「情報科学実習1」のように算用数字で書かれているため。
 * NFKC で Ⅰ は I に、Ⅱ は II になる。「AI」「IT」のような英字の略語は変えない（直前が日本語の文字のときだけ）
 */
export function normalizeCourseNumerals(text: string): string {
  const roman: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8' };
  return text
    .normalize('NFKC')
    .replace(/(?<=[぀-ヿ一-鿿々ー])(VIII|VII|VI|IV|V|III|II|I)(?![A-Za-z])/g, (m) => roman[m] ?? m);
}

export function baseCourseName(name: string): string {
  return normalizeCourseNumerals(name)
    .replace(/【[^】]*】/g, '')
    .replace(/\([^()]*\)/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// 再履修者・逆履修者向けのクラス。通常の履修提案には含めない
export function isRetakeClass(course: LectureCourse): boolean {
  return /【再】|\(再履修\)|\(再\)|\(逆|再履修/.test(course.name.normalize('NFKC')) || course.group === '再履修';
}

// 完全一致、番号の範囲（健康・スポーツ教育実習1〜5）、番号違い（基礎プログラミング1,2）、部分一致の順に探す
export function findCourseRows(db: LectureCourse[], query: string): LectureCourse[] {
  const q = baseCourseName(query);
  if (!q) return [];
  // 「英語1(地理)」のようにクラスまで指定されたときだけ完全一致で絞る
  const full = query.normalize('NFKC').replace(/\s+/g, '');
  if (full !== q) {
    const exactFull = db.filter((c) => c.name.normalize('NFKC').replace(/\s+/g, '') === full);
    if (exactFull.length > 0) return exactFull;
  }
  const exact = db.filter((c) => baseCourseName(c.name) === q);
  if (exact.length > 0) return exact;
  const inRange = db.filter((c) => {
    const m = baseCourseName(c.name).match(/^(.*?)(\d+)〜(\d+)$/);
    const qm = q.match(/^(.*?)(\d+)$/);
    return !!m && !!qm && m[1] === qm[1] && +qm[2] >= +m[2] && +qm[2] <= +m[3];
  });
  if (inRange.length > 0) return inRange;
  const numbered = db.filter((c) => {
    const base = baseCourseName(c.name);
    return base.startsWith(q) && /^\d/.test(base.slice(q.length));
  });
  if (numbered.length > 0) return numbered;
  return q.length >= 3 ? db.filter((c) => baseCourseName(c.name).includes(q)) : [];
}

function gradeAllows(course: LectureCourse, grade?: number): boolean {
  if (!grade || !course.grade) return true;
  const range = course.grade.normalize('NFKC').match(/([1-4])\s*[〜~-]\s*([1-4])/);
  if (range) return grade >= +range[1] && grade <= +range[2];
  const single = course.grade.match(/[1-4]/);
  return single ? +single[0] === grade : true;
}

function targetAllows(course: LectureCourse, department?: string): boolean {
  if (!department || !course.targets || course.targets.length === 0) return true;
  return course.targets.includes(department);
}

function isEligible(course: LectureCourse, student?: StudentContext): boolean {
  return gradeAllows(course, student?.grade) && targetAllows(course, student?.department) && isInSemester(course, student?.semester);
}

function isTaken(course: LectureCourse, student?: StudentContext): boolean {
  const base = baseCourseName(course.name);
  return !!student?.takenCourses?.some((t) => baseCourseName(t) === base);
}

// 連続コマで開講される実験・演習は1つの授業として扱う
export interface CourseSection {
  name: string;
  teacher: string;
  room: string;
  semester?: string;
  department: string;
  group?: string;
  targets?: string[];
  slots: { day: string; period: number }[];
}

const CONTINUOUS_CLASS = /実験|実習|含演習|連続/;

export function groupIntoSections(rows: LectureCourse[]): CourseSection[] {
  const sections: CourseSection[] = [];
  [...rows]
    .filter((c) => c.period > 0)
    .sort((a, b) => a.day.localeCompare(b.day) || a.period - b.period)
    .forEach((c) => {
      const previous = sections.find((s) => {
        const last = s.slots[s.slots.length - 1];
        return (
          s.name === c.name &&
          s.teacher === c.teacher &&
          s.room === c.room &&
          s.semester === c.semester &&
          last.day === c.day &&
          last.period + 1 === c.period &&
          CONTINUOUS_CLASS.test(c.name) &&
          !c.name.includes('健康・スポーツ')
        );
      });
      if (previous) {
        previous.slots.push({ day: c.day, period: c.period });
      } else {
        sections.push({
          name: c.name,
          teacher: c.teacher,
          room: c.room,
          semester: c.semester,
          department: c.department,
          group: c.group,
          targets: c.targets,
          slots: [{ day: c.day, period: c.period }]
        });
      }
    });
  return sections;
}

function termsOverlap(a?: string, b?: string): boolean {
  if (!a || !b || a.includes('通年') || b.includes('通年')) return true;
  return (a.includes('前') && b.includes('前')) || (a.includes('後') && b.includes('後'));
}

function sectionsClash(a: CourseSection, b: CourseSection): boolean {
  return termsOverlap(a.semester, b.semester) && a.slots.some((s) => b.slots.some((t) => s.day === t.day && s.period === t.period));
}

function describeSlots(section: CourseSection): string {
  const first = section.slots[0];
  const last = section.slots[section.slots.length - 1];
  const periods = section.slots.length > 1 ? `${first.period}〜${last.period}限` : `${first.period}限`;
  return `${section.semester ? `${section.semester}の` : ''}${first.day}曜${periods}`;
}

function describeSection(section: CourseSection): string {
  return `${section.name}（${describeSlots(section)} / ${section.teacher}先生 / ${getCompactRoomLabel(section.room)}）`;
}

// =========================================================================
// 2. 履修登録サポート＆「空きコマ」活用提案
// =========================================================================
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: { courses: string[] }[];
  notFound: string[];
  formattedReport: string;
}

export function checkCourseConflicts(courseNames: string[], curriculum?: string, student?: StudentContext): ConflictCheckResult {
  const db = getLectureDatabase(curriculum);
  const lines: string[] = ['時間割の重複をチェックしてみました！', ''];
  const notFound: string[] = [];
  const candidates: { label: string; sections: CourseSection[] }[] = [];

  courseNames.forEach((name) => {
    const allRows = findCourseRows(db, name).filter((c) => c.period > 0 && !isRetakeClass(c));
    // 他学科に同名の科目があるときは自学科の開講を優先する
    const ownRows = allRows.filter((c) => c.department === student?.department);
    const rows = ownRows.length > 0 ? ownRows : allRows;
    const eligible = rows.filter((c) => isEligible(c, student));
    const sections = groupIntoSections(eligible.length > 0 ? eligible : rows);
    if (sections.length === 0) {
      notFound.push(name);
    } else {
      candidates.push({ label: name, sections });
    }
  });

  // 開講クラスの組み合わせを探す（クラスが複数あれば重ならない組み合わせが見つかることがある）
  const order = [...candidates].sort((a, b) => a.sections.length - b.sections.length);
  const chosen: CourseSection[] = [];
  let budget = 50000;
  const search = (index: number): boolean => {
    if (index === order.length) return true;
    for (const section of order[index].sections) {
      if (budget-- <= 0) return false;
      if (chosen.some((c) => sectionsClash(c, section))) continue;
      chosen.push(section);
      if (search(index + 1)) return true;
      chosen.pop();
    }
    return false;
  };
  const feasible = search(0);

  const conflicts: { courses: string[] }[] = [];
  if (feasible) {
    if (candidates.length >= 2) {
      const multiple = candidates.some((c) => c.sections.length > 1);
      lines.push(multiple
        ? '重ならずに登録できる組み合わせが見つかりましたよ。たとえば次のクラスを選ぶと大丈夫です。'
        : 'チェックした科目の中で時間の重複はありませんでした！すべて重ならずに登録できますよ。');
      lines.push(chosen.map(describeSection).join('、'));
    } else {
      lines.push('重複を調べるには、時間割で見つかる科目が2つ以上必要です。');
    }
  } else {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const allClash = a.sections.every((s) => b.sections.every((t) => sectionsClash(s, t)));
        if (allClash) {
          conflicts.push({ courses: [a.label, b.label] });
          lines.push(`${describeSection(a.sections[0])} と ${describeSection(b.sections[0])} は時間が重なってしまっています。同じコマには1科目しか登録できないので、どちらか一方を選んでみてくださいね。`);
        }
      }
    }
    if (conflicts.length === 0) {
      conflicts.push({ courses: candidates.map((c) => c.label) });
      lines.push('どのクラスを選んでも、すべてを同時に登録できる組み合わせが見つかりませんでした。どれか1科目を別の学期や別の科目に変えてみてくださいね。');
    }
  }

  if (notFound.length > 0) {
    lines.push('', `${notFound.join('、')}は令和8年度の時間割データで見つかりませんでした。科目名を確認してみてくださいね。`);
  }

  return {
    hasConflict: !feasible,
    conflicts,
    notFound,
    formattedReport: lines.join('\n')
  };
}

export function suggestCoursesForFreePeriod(
  day: string,
  period: number,
  categoryFilter?: string,
  curriculum?: string,
  student?: StudentContext
): string {
  const db = getLectureDatabase(curriculum);
  const term = student?.semester || getCampusClock().semester;
  const inSlot = db.filter(
    (c) => c.day === day && c.period === period && isInSemester(c, term) && !isRetakeClass(c) && gradeAllows(c, student?.grade) && targetAllows(c, student?.department) && !isTaken(c, student)
  );
  const isCommon = (c: LectureCourse) => /総合|外国語|基礎教育|全学/.test(c.department);
  const isOwnDept = (c: LectureCourse) => !!student?.department && c.department === student.department;
  const filtered = categoryFilter
    ? inSlot.filter((c) => c.department.includes(categoryFilter) || c.name.includes(categoryFilter))
    : inSlot.filter((c) => isCommon(c) || isOwnDept(c));
  const matches = filtered.length > 0 || categoryFilter ? filtered : inSlot;

  const lines: string[] = [`${term}の${day}曜${period}限に履修できる科目をお調べしました！`, ''];
  if (matches.length > 0) {
    // 学科の科目、総合教育の順に並べる
    const sorted = [...matches].sort((a, b) => Number(isOwnDept(b)) - Number(isOwnDept(a)));
    // 8件で切ると、聞きたい科目が「ほかにも〇科目」に隠れてしまうので12件まで出す
    const LIMIT = 12;
    const listText = sorted.slice(0, LIMIT).map((c) => `${c.name}（${c.teacher}先生 / ${getCompactRoomLabel(c.room)} / ${c.department}）`).join('、');
    lines.push(`${listText} が開講されていますよ。${sorted.length > LIMIT ? `ほかにも${sorted.length - LIMIT}科目あります。科目名で聞いてもらえれば、そのコマにあるか確かめます。` : ''}`);
  } else {
    lines.push(categoryFilter
      ? `このコマに「${categoryFilter}」で履修できそうな科目は見つかりませんでした。`
      : 'このコマに履修できそうな科目は見つかりませんでした。');
  }
  lines.push('');
  lines.push('総合教育科目は人文系、社会系、理学系からそれぞれ2単位ずつ取る必要があるので、空きコマを上手に活用してみてくださいね。一部の総合教育科目は抽選があるので、COMITS2の抽選科目一覧も確認しておくと安心です。');
  return lines.join('\n');
}

// =========================================================================
// 3. 学部要覧連動「必修組み込み済みの自動スケジュール提案」
// =========================================================================
export function proposeAutomaticSchedule(
  department: string,
  grade: number,
  curriculum?: string,
  requiredCourseNames: string[] = [],
  semester?: Semester,
  takenCourses: string[] = []
): string {
  const db = getLectureDatabase(curriculum);
  const term = semester || getCampusClock().semester;
  const student: StudentContext = { department, grade, semester: term, takenCourses };

  // 他学科の専門科目は同名でも対象にしない
  const offeredToDept = (c: LectureCourse) => !c.department.endsWith('学科') || c.department === department;
  const items: { name: string; sections: CourseSection[] }[] = [];
  const otherTerm: string[] = [];
  const otherGrade: string[] = [];
  const missing: string[] = [];

  requiredCourseNames.forEach((required) => {
    if (takenCourses.some((t) => baseCourseName(t) === baseCourseName(required))) return;
    // 外国語は個人ごとにクラスが異なるので、案内文で別に伝える
    if (/^(英語|ドイツ語|中国語)\d+〜\d+$/.test(baseCourseName(required))) return;
    const rows = findCourseRows(db, required).filter((c) => c.period > 0 && !isRetakeClass(c) && offeredToDept(c) && targetAllows(c, department));
    if (rows.length === 0) {
      missing.push(required);
      return;
    }
    const inGrade = rows.filter((c) => gradeAllows(c, grade));
    if (inGrade.length === 0) {
      otherGrade.push(required);
      return;
    }
    const inTerm = inGrade.filter((c) => isInSemester(c, term));
    if (inTerm.length === 0) {
      otherTerm.push(required);
      return;
    }
    // 「基礎プログラミング」のように番号違いの科目が複数あれば、それぞれを配置する
    const byName = new Map<string, LectureCourse[]>();
    inTerm.forEach((c) => {
      const key = baseCourseName(c.name);
      byName.set(key, [...(byName.get(key) || []), c]);
    });
    byName.forEach((list, key) => {
      if (!items.some((i) => i.name === key)) items.push({ name: key, sections: groupIntoSections(list) });
    });
  });

  // 開講クラスが少ない科目から配置する
  const placed: { section: CourseSection; kind: string }[] = [];
  const unplaced: string[] = [];
  [...items].sort((a, b) => a.sections.length - b.sections.length).forEach((item) => {
    const section = item.sections.find((s) => !placed.some((p) => sectionsClash(p.section, s)));
    if (section) {
      placed.push({ section, kind: '必修' });
    } else {
      unplaced.push(item.name);
    }
  });

  // 空いたコマに総合教育科目を3つまで提案する。英語開講や演習形式を除き、授業の少ない曜日の2〜4限を優先する
  const electiveSections = groupIntoSections(
    db.filter((c) => c.period > 0 && c.day !== '土' && c.department === '総合教育' && isEligible(c, student) && !isTaken(c, student))
  ).filter((s) => !/[A-Za-z]|英語|総合研究/.test(s.name));
  const usedNames = new Set(placed.map((p) => baseCourseName(p.section.name)));
  const dayLoad = (day: string) => placed.filter((p) => p.section.slots[0].day === day).length;
  for (let added = 0; added < 3; added++) {
    const open = electiveSections.filter((s) => !usedNames.has(baseCourseName(s.name)) && !placed.some((p) => sectionsClash(p.section, s)));
    if (open.length === 0) break;
    const score = (s: CourseSection) => dayLoad(s.slots[0].day) * 2 + (s.slots[0].period >= 2 && s.slots[0].period <= 4 ? 0 : 1);
    const best = open.reduce((a, b) => (score(b) < score(a) ? b : a));
    placed.push({ section: best, kind: '総合教育' });
    usedNames.add(baseCourseName(best.name));
  }

  const curLabel = curriculum === 'reiwa6_or_earlier' ? '令和6年度以前入学者向け' : '令和7年度以降入学者向け';
  const lines: string[] = [`${department}${grade}年生の${term}の時間割案を、${curLabel}の時間割から考えてみました！`, ''];

  const days = ['月', '火', '水', '木', '金', '土'];
  days.forEach((day) => {
    const inDay = placed
      .filter((p) => p.section.slots[0].day === day)
      .sort((a, b) => a.section.slots[0].period - b.section.slots[0].period);
    if (inDay.length > 0) {
      const text = inDay.map((p) => `${describeSlots(p.section).replace(/^.*?の/, '').replace(/^.曜/, '')}に${p.section.name}（${p.kind} / ${p.section.teacher}先生 / ${getCompactRoomLabel(p.section.room)}）`).join('、');
      lines.push(`${day}曜日は、${text} です。`);
    } else if (day !== '土') {
      lines.push(`${day}曜日は授業を入れていないので、自習や課題に充てられますよ。`);
    }
  });

  lines.push('');
  if (otherTerm.length > 0) lines.push(`${otherTerm.join('、')}は${term === '前期' ? '後期' : '前期'}の開講なので、今回の案には入れていません。`);
  if (unplaced.length > 0) lines.push(`${unplaced.join('、')}は他の必修と時間が重なり、配置できませんでした。開講クラスを確認してみてくださいね。`);
  if (otherGrade.length > 0) lines.push(`${otherGrade.join('、')}は時間割上は${grade}年次の配当ではありませんでした。`);
  if (missing.length > 0) lines.push(`${missing.join('、')}は令和8年度の時間割で同じ名前の科目が見つからなかったので、配置していません。学部要覧と教務課の案内で確認してください。`);

  // 要覧の必修一覧にない、学科の同学年配当科目も伝える
  const known = new Set([...requiredCourseNames.map(baseCourseName), ...placed.map((p) => baseCourseName(p.section.name))]);
  const extras = Array.from(new Set(
    db.filter((c) => c.department === department && c.grade === String(grade) && c.period > 0 && isInSemester(c, term) && !isRetakeClass(c))
      .map((c) => baseCourseName(c.name))
  )).filter((n) => !known.has(n));
  if (extras.length > 0) {
    lines.push(`このほか、時間割で${department}の${grade}年次に配当されている科目として ${extras.slice(0, 8).join('、')} があります。必修かどうかは学部要覧で確認してくださいね。`);
  }

  lines.push('');
  lines.push('組やクラスの指定がある科目は、自分のクラスに合わせて選び直してください。外国語は人によってクラスが異なるので、この案には入れていません。年間の履修上限は40単位が基本です。');
  return lines.join('\n');
}

// =========================================================================
// 4. キャンパス移動・10分休みの最適化ナビ
// =========================================================================
export interface TransitOptions {
  day?: string;
  period?: number; // 移動先の授業の時限
  semester?: Semester;
}

export function calculateTransitOptimization(fromRoomRaw: string, toRoomRaw: string, options: TransitOptions = {}): string {
  const parseRoom = (r: string) => {
    const clean = normalizeRoom(r);
    let bld = '他';
    let floor = 1;
    if (/^1\d{2}/.test(clean)) {
      bld = '1号館';
      floor = parseInt(clean[1], 10);
    } else if (/^2\d{3}/.test(clean)) {
      bld = '2号館';
      floor = parseInt(clean[1], 10);
    } else if (/^3\d{3}/.test(clean)) {
      bld = '3号館';
      floor = parseInt(clean[1], 10);
    } else if (/^4\d{2}/.test(clean)) {
      bld = '4号館';
      floor = parseInt(clean[1], 10);
    } else if (/^7\d{3}/.test(clean)) {
      bld = '7号館';
      floor = parseInt(clean[1], 10);
    } else if (/^8[AB]/.test(clean)) {
      bld = '8号館';
      floor = parseInt(clean[2], 10) || 1;
    }
    return { name: clean, bld, floor };
  };

  const from = parseRoom(fromRoomRaw);
  const to = parseRoom(toRoomRaw);

  const lines: string[] = [
    `${getCompactRoomLabel(from.name)}から${getCompactRoomLabel(to.name)}への移動ですね！`,
    ''
  ];

  let estMinutes = 5;
  let routeAdvice = '';

  if (from.bld === to.bld) {
    const floorDiff = Math.abs(from.floor - to.floor);
    estMinutes = Math.max(2, floorDiff + 1);
    routeAdvice = `同じ${from.bld}内の移動（${from.floor}階から${to.floor}階）です。休み時間はエレベーターが並びやすいので、階段を使うとスムーズですよ。`;
  } else if ((from.bld === '3号館' && to.bld === '1号館') || (from.bld === '1号館' && to.bld === '3号館')) {
    estMinutes = 5 + (from.floor >= 4 ? 2 : 0);
    routeAdvice = '3号館と1号館は中庭（サクラプロムナード）を挟んで向かい合っています。3号館の上層階から降りるときはエレベーターが混むので、階段で1階に降りて中庭通路を抜けるルートがおすすめです。';
  } else if ((from.bld === '4号館' && to.bld === '1号館') || (from.bld === '1号館' && to.bld === '4号館')) {
    estMinutes = 4;
    routeAdvice = '1号館と4号館はお隣の建物です。1階のエントランス通路を通ると移動しやすいですよ。';
  } else if ((from.bld === '3号館' && to.bld === '4号館') || (from.bld === '4号館' && to.bld === '3号館')) {
    estMinutes = 3;
    routeAdvice = '3号館と4号館は隣接しているので、渡り通路を使うと移動しやすいですよ。';
  } else {
    routeAdvice = `${from.bld}から${to.bld}へは屋外通路を歩いて移動します。`;
  }

  lines.push(estMinutes <= 7
    ? `移動時間は約${estMinutes}分が目安なので、10分休みで間に合いますよ。`
    : `移動時間は約${estMinutes}分が目安で、10分休みだと余裕がありません。前の授業が終わったらすぐに移動しましょう。`);
  lines.push(routeAdvice);

  // 移動先の教室が前のコマに空いていれば、早めに入室できる
  const term = options.semester || getCampusClock().semester;
  if (options.day && options.period && options.period > 1) {
    const previousPeriod = options.period - 1;
    const usage = findRoomUsage(to.name, options.day, previousPeriod, term);
    if (usage.length > 0) {
      lines.push(`${term}の${options.day}曜${previousPeriod}限は、${to.name}教室で${usage[0].name}が行われているので、前の授業が終わるまでは入室できません。`);
    } else if (options.period === 3) {
      lines.push(`間にお昼休みがあるので、時間に余裕がありますよ。${to.name}教室は2限に授業が入っていません。`);
    } else {
      lines.push(`${term}の${options.day}曜${previousPeriod}限は${to.name}教室に授業が入っていないので、早めに入って自習もできそうですよ。`);
    }
  } else if (options.period === 1) {
    lines.push('1限の前は、前のコマの授業はありませんよ。');
  }

  return lines.join('\n');
}

// =========================================================================
// 5. 科目・教員・教室の逆引き検索 & 教室使用スケジュール
// =========================================================================
export function getRoomDailySchedule(roomNumber: string, targetDay?: string, semester?: Semester, now: Date = new Date()): string {
  const clock = getCampusClock(now);
  const term = semester || clock.semester;
  const cleanRoom = normalizeRoom(roomNumber);
  if (!isKnownRoom(cleanRoom)) {
    return `${cleanRoom}教室は時間割データで見つかりませんでした。教室番号を確認してみてくださいね。`;
  }
  const curDay = targetDay || clock.day;
  if (curDay === '日') {
    return `日曜日は授業がありません。「月曜の${cleanRoom}は何限に使われている？」のように曜日を指定してもらえれば、お調べしますよ。`;
  }

  const lines: string[] = [`${term}の${curDay}曜日の${getCompactRoomLabel(cleanRoom)}の予定を確認しました！`, ''];
  PERIOD_TIMES.forEach(({ period }) => {
    const hits = findRoomUsage(cleanRoom, curDay, period, term);
    lines.push(hits.length > 0
      ? `${period}限は${hits[0].name}（${hits[0].teacher}先生）で使用中です。`
      : `${period}限は授業が入っていないので、空き教室として使えそうですよ。`);
  });
  lines.push('', 'お昼休み（12時10分から13時）は全教室が自習や休憩に開放されています！');
  return lines.join('\n');
}

export function describeRoomSlot(roomNumber: string, day: string, period: number, semester?: Semester, now: Date = new Date()): string {
  const term = semester || getCampusClock(now).semester;
  const cleanRoom = normalizeRoom(roomNumber);
  if (!isKnownRoom(cleanRoom)) {
    return `${cleanRoom}教室は時間割データで見つかりませんでした。教室番号を確認してみてくださいね。`;
  }
  const hits = findRoomUsage(cleanRoom, day, period, term);
  if (hits.length === 0) {
    return `${term}の${day}曜${period}限の${getCompactRoomLabel(cleanRoom)}には授業が入っていないので、空き教室として使えそうですよ。`;
  }
  const h = hits[0];
  return `${term}の${day}曜${period}限の${getCompactRoomLabel(cleanRoom)}は、${h.teacher}先生の『${h.name}』が行われていますよ。対象は${h.grade ? `${h.grade}年、` : ''}${h.department}です。`;
}

// 科目や教員の検索結果を日付順に読みやすく整形する
export function describeCourseRow(c: LectureCourse): string {
  const target = c.targets && c.targets.length > 0 ? `、対象は${c.targets.join('・')}` : '';
  const grade = c.grade ? `、${c.grade.includes('年') ? c.grade : `${c.grade}年`}` : '';
  if (c.period === 0) {
    const when = c.schedule ? `日程は${c.schedule}` : '日程は別途案内';
    return `${c.name}（${c.teacher}先生）は${c.semester || ''}の${c.day === 'その他' ? '遠隔授業' : '集中授業'}で、${when}、場所は${c.place || c.room}です。`;
  }
  return `${c.name}（${c.teacher}先生）は${c.semester ? `${c.semester}の` : ''}${c.day}曜${c.period}限、${getCompactRoomLabel(c.room)}です（${c.department}${grade}${target}）。`;
}
