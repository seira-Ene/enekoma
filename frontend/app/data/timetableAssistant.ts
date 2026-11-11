// 時間割に関する質問を実データで答える。ローカル応答とGeminiへの参照データの両方がこの結果を使う
import {
  baseCourseName,
  calculateTransitOptimization,
  checkCourseConflicts,
  describeCourseRow,
  describeRoomSlot,
  findCourseRows,
  findFreeRooms,
  findRoomUsage,
  getCampusClock,
  getCompactRoomLabel,
  getLectureDatabase,
  getRoomDailySchedule,
  groupIntoSections,
  isInSemester,
  isRetakeClass,
  LectureCourse,
  normalizeCourseNumerals,
  PERIOD_TIMES,
  proposeAutomaticSchedule,
  resolvePeriodAt,
  Semester,
  StudentContext,
  suggestCoursesForFreePeriod
} from './courses';
import { VERIFIED_12_DEPARTMENTS_CURRICULUM } from './departmentCurriculum';
import { GAKUBU_YORAN_DEPARTMENTS, UserProfileData } from './gakubuYoran';

const DAYS = ['月', '火', '水', '木', '金', '土'];
const ROOM_PATTERN = /(8[AB]\d{3}|88\d{3}|7\d{3}|[1-4]\d{2,3}[AB]?)/gi;

export interface TimeSlot {
  day: string;
  period: number;
}

function parseSemester(q: string): Semester | undefined {
  if (/前期|前学期/.test(q)) return '前期';
  if (/後期|後学期/.test(q)) return '後期';
  return undefined;
}

function parseRooms(q: string): string[] {
  // 「300円」「40単位」「9:00」のような数字を教室番号と誤認しない
  const stripped = q.replace(/\d+\s*(?:単位|円|分|人|回|年|月|日|時)/g, ' ').replace(/\d{1,2}[:：]\d{2}/g, ' ');
  return (stripped.match(ROOM_PATTERN) || []).map((r) => r.toUpperCase());
}

function parseDay(q: string, now: Date): string | undefined {
  const clock = getCampusClock(now);
  const index = ['日', ...DAYS].indexOf(clock.day);
  if (q.includes('明後日')) return ['日', ...DAYS][(index + 2) % 7];
  if (q.includes('明日')) return ['日', ...DAYS][(index + 1) % 7];
  if (/今日|本日/.test(q)) return clock.day;
  const named = q.match(/([月火水木金土])曜/);
  if (named) return named[1];
  const shorthand = q.match(/([月火水木金土])\s*の?\s*[1-5]\s*(?:限|時限|コマ)/) || q.match(DAY_PERIOD_SHORTHAND);
  return shorthand ? shorthand[1] : undefined;
}

// 「月4」「火曜3」のような曜日と時限の略し方。「11月4日」「4月」「月4回」は時限にしない
const DAY_PERIOD_SHORTHAND = /(?<![0-9])([月火水木金土])(?:曜日?)?\s*([1-5])(?![0-9]|\s*(?:日|月|年|号|時|分|単位|円|人|回|週|コマ目))/;

function parsePeriod(q: string): number | undefined {
  const named = q.match(/([1-5])\s*(?:時限|限|コマ)/);
  if (named) return parseInt(named[1], 10);
  const shorthand = q.match(DAY_PERIOD_SHORTHAND);
  return shorthand ? parseInt(shorthand[2], 10) : undefined;
}

// 「14時」「14:30」を時限に換算する
function parseClockPeriod(q: string): number | undefined {
  const time = q.match(/(\d{1,2})\s*(?:[:：]\s*(\d{2})|時(半)?)/);
  if (!time) return undefined;
  const hour = parseInt(time[1], 10);
  if (hour < 8 || hour > 18) return undefined;
  const minute = time[2] ? parseInt(time[2], 10) : time[3] ? 30 : 0;
  return resolvePeriodAt(hour * 60 + minute).period ?? undefined;
}

function toStudent(profile: UserProfileData | null | undefined, semester?: Semester): StudentContext {
  const taken = [
    ...(profile?.completedCourses || []).map((c) => c.name),
    ...(profile?.enrolledCourses || []).map((c) => c.name)
  ];
  return { department: profile?.department, grade: profile?.grade, semester, takenCourses: taken };
}

// 科目名を探すための形（全角・半角、空白、ローマ数字の違いをそろえる）
const compactQuery = (q: string) => normalizeCourseNumerals(q).replace(/\s+/g, '');
const bigrams = (s: string) => {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
};

export interface CourseNameMatch {
  name: string;
  exact: boolean; // 文章に科目名がそのまま含まれている
  common: number; // 文章と共通する2文字の組の数（多いほど長く一致している）
}

/**
 * 文章に含まれる科目名を探す。そのまま含まれる名前に加えて、少し違う書き方
 * （「次世代コミュニティ情報科学1」→ 次世代社会コミュニティ情報科学1、「データ構造とアルゴリズム」→ アルゴリズムとデータ構造）も、
 * 科目名の2文字の組の75%以上が文章にあれば候補にする。番号つきの科目（〇〇1）は、文章に数字があればその番号と合うものだけ
 */
export function rankCourseNames(q: string, db: LectureCourse[]): CourseNameMatch[] {
  const text = compactQuery(q);
  const textGrams = bigrams(text);
  const numbers: string[] = text.match(/\d+/g) ?? [];
  const names = Array.from(new Set(db.map((c) => baseCourseName(c.name)))).filter((n) => n.length >= 2);
  const matches: CourseNameMatch[] = [];
  for (const name of names) {
    const exact = text.includes(name);
    const grams = bigrams(name);
    let common = 0;
    grams.forEach((g) => textGrams.has(g) && common++);
    if (!exact) {
      if (name.length < 5 || grams.size === 0 || common / grams.size < 0.75) continue;
      const trailing = name.match(/(\d+)$/)?.[1];
      if (trailing && numbers.length > 0 && !numbers.includes(trailing)) continue;
    }
    matches.push({ name, exact, common: exact ? Math.max(common, grams.size) : common });
  }
  return matches.sort((a, b) => b.common - a.common || Number(b.exact) - Number(a.exact) || b.name.length - a.name.length);
}

// 文章に含まれる科目名を長い名前から順に取り出す。そのまま含まれる名前より長く一致する、少し違う書き方の名前があればそれを先にする
// （「次世代コミュニティ情報科学1」で、途中の「情報科学」だけを拾わないため）
function findCourseNamesInText(q: string, db: LectureCourse[]): string[] {
  let rest = compactQuery(q);
  const names = Array.from(new Set(db.map((c) => baseCourseName(c.name)))).filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  const found: string[] = [];
  names.forEach((name) => {
    if (rest.includes(name)) {
      found.push(name);
      rest = rest.split(name).join(' ');
    }
  });
  const best = rankCourseNames(q, db)[0];
  if (best && !best.exact) {
    const longestExact = Math.max(0, ...found.map((n) => bigrams(n).size));
    if (best.common > longestExact) {
      // 候補の名前の一部にすぎない名前（「情報科学」「アルゴリズム」）は外す
      return [best.name, ...found.filter((n) => !best.name.includes(n))];
    }
  }
  return found;
}

function findTeachersInText(q: string, db: LectureCourse[]): string[] {
  const compact = q.normalize('NFKC').replace(/\s+/g, '');
  const teachers = Array.from(new Set(db.flatMap((c) => (c.teacher || '').split(/\s*\/\s*/)))).filter(Boolean);
  const full = teachers.filter((t) => t.replace(/\s+/g, '').length >= 3 && compact.includes(t.replace(/\s+/g, '')));
  if (full.length > 0) return full;
  // 名字だけのときは「先生」などが続く場合に限る。「谷先生」のような1文字の名字は、直前に漢字がないときだけ（「大谷先生」と区別する）
  return teachers.filter((t) => {
    const surname = t.split(' ')[0];
    if (!t.includes(' ') || !surname) return false;
    const guard = surname.length === 1 ? '(?<![\\u4e00-\\u9fff々])' : '';
    return new RegExp(`${guard}${surname}(先生|教授|准教授|講師|さん)`).test(compact);
  });
}

const CURRICULUM_LABEL: Record<string, string> = {
  reiwa7_or_later: '令和7年度以降入学者向け',
  reiwa6_or_earlier: '令和6年度以前入学者向け'
};

// 対応科目の候補（同じ先生・同じ時間という一致からの推測）を示す文。Geminiに断定させない指示の目印にも使う
export const COUNTERPART_NOTE = '同じ先生が同じ時間に次の科目を教えています（名前が変わった対応科目かもしれません）。';
// 推測の対応科目を案内するときの言い方の指示（buildTimetableContext が検索結果に足す）
export const COUNTERPART_TONE_RULE =
  '検索結果の「同じ先生が同じ時間に次の科目を教えています」は、教員と開講時限が一致したことからの推測で、対応科目と確定した情報ではありません。' +
  '「対応しています」「この名前で登録されているはずです」「〇〇が対応科目です」のように断定せず、' +
  '「〇〇が対応科目の可能性があります」「〇〇が対応科目と考えられます」のように可能性を示す控えめな言い方で伝え、' +
  '確かめたいときはシラバスか教務課で確認するよう添えてください。';

const teacherList = (c: LectureCourse) => (c.teacher || '').split(/\s*\/\s*/).filter(Boolean);
const slotLabel = (c: LectureCourse) => `${c.semester}の${c.day}曜${c.period}限`;

interface LookupOptions {
  day?: string;
  period?: number;
  explicitSemester?: Semester;
  semester: Semester;
  department?: string;
}

/**
 * 科目名で時間割を引いた答え。曜日・時限まで聞かれたら（「〇〇は月曜4限？」「月4の〇〇」）、そのコマにあるかを先に答える。
 * 少し違う書き方で見つけた科目は「〇〇のことですね」と正しい名前を添える
 */
function describeNamedCourse(name: string, db: LectureCourse[], exact: boolean, o: LookupOptions, bare = false): string | null {
  const rows = findCourseRows(db, name).filter((c) => !o.explicitSemester || isInSemester(c, o.semester));
  if (rows.length === 0) return null;
  const own = o.department ? rows.filter((c) => !c.targets?.length || c.targets.includes(o.department as string)) : rows;
  const shown = own.length > 0 ? own : rows;
  // bare: もう一方のカリキュラムの案内の中で使うとき（見出しは呼び出し側が付ける）
  const head = exact || bare ? '' : `「${name}」のことですね。`;
  if (o.day) {
    const atSlot = shown.filter((c) => c.day === o.day && (o.period === undefined || c.period === o.period));
    const asked = `${o.day}曜${o.period ? `${o.period}限` : ''}`;
    if (atSlot.length > 0) {
      return `${head ? `${head}\n` : ''}はい、${name}は${Array.from(new Set(atSlot.map(slotLabel))).join('・')}に開講されています。\n\n${listRows(atSlot)}`;
    }
    return `${head ? `${head}\n` : ''}${name}は、${asked}には開講されていません。開講されているのは次のコマです。\n\n${listRows(shown)}`;
  }
  if (bare) return listRows(shown);
  return `${head ? `${head}お調べしました！` : `${name}についてお調べしました！`}\n\n${listRows(shown)}`;
}

/**
 * 今のカリキュラムの時間割にない科目・先生が、もう一方のカリキュラムにあれば知らせる（推測で答えないため）。
 * 科目なら、同じ先生が同じ学期・曜日・時限に教えている今のカリキュラムの科目（名前が変わった対応科目の候補）も添える
 */
function answerFromOtherCurriculum(q: string, curriculum: string | undefined, o: LookupOptions, match?: CourseNameMatch): string | null {
  const mine = curriculum === 'reiwa6_or_earlier' ? 'reiwa6_or_earlier' : 'reiwa7_or_later';
  const other = mine === 'reiwa7_or_later' ? 'reiwa6_or_earlier' : 'reiwa7_or_later';
  const otherDb = getLectureDatabase(other);
  const inTerm = (c: LectureCourse) => !o.explicitSemester || isInSemester(c, o.semester);
  const footer = 'プロフィールの入学年度が違っていたら、基本設定の「入学年度」を変えてからもう一度聞いてくださいね。';
  const teachers = match ? [] : findTeachersInText(q, otherDb);
  if (teachers.length > 0) {
    const rows = otherDb.filter((c) => teachers.some((t) => teacherList(c).includes(t)) && inTerm(c));
    if (rows.length === 0) return null;
    return [
      `${teachers.join('、')}先生の授業は、${CURRICULUM_LABEL[mine]}の時間割にはありませんでした。`,
      `${CURRICULUM_LABEL[other]}の時間割には次のように載っています。`,
      '',
      listRows(rows),
      '',
      footer
    ].join('\n');
  }
  const found = match || rankCourseNames(q, otherDb)[0];
  if (!found) return null;
  const body = describeNamedCourse(found.name, otherDb, found.exact, o, true);
  if (!body) return null;
  const otherRows = findCourseRows(otherDb, found.name).filter(inTerm);
  const myDb = getLectureDatabase(mine);
  const counterparts = myDb.filter(
    (c) =>
      baseCourseName(c.name) !== found.name &&
      otherRows.some((r) => r.semester === c.semester && r.day === c.day && r.period === c.period && teacherList(r).some((t) => teacherList(c).includes(t)))
  );
  // 文章にそのまま含まれる、今のカリキュラムの別の科目（「アルゴリズム」「データ構造」など）も知らせる
  const counterpartNames = new Set(counterparts.map((c) => baseCourseName(c.name)));
  const ownNamed = rankCourseNames(q, myDb)
    // 名前のごく一部にすぎないもの（「次世代社会コミュニティ情報科学1」の中の「情報科学」）は出さない
    .filter((m) => m.exact && !counterpartNames.has(m.name) && m.name.length >= found.name.length * 0.4)
    .slice(0, 2)
    .flatMap((m) => findCourseRows(myDb, m.name).filter(inTerm).slice(0, 2));
  return [
    found.exact
      ? `「${found.name}」は、${CURRICULUM_LABEL[mine]}の時間割にはありませんでした。`
      : `お聞きの科目は「${found.name}」だと思います。この科目は、${CURRICULUM_LABEL[mine]}の時間割にはありませんでした。`,
    `${CURRICULUM_LABEL[other]}の時間割には次のように載っています。`,
    '',
    body,
    ...(counterparts.length > 0
      ? ['', `${CURRICULUM_LABEL[mine]}の時間割では、${COUNTERPART_NOTE}`, listRows(counterparts, 4)]
      : []),
    ...(ownNamed.length > 0 ? ['', `${CURRICULUM_LABEL[mine]}の時間割には、別の科目として次もあります。`, listRows(ownNamed, 4)] : []),
    '',
    footer
  ].join('\n');
}

// 今期の時間割から今日の次の授業を探し、その教室に早めに入れるかを答える
function answerEarlyEntry(profile: UserProfileData | null | undefined, now: Date, semester: Semester): string {
  const clock = getCampusClock(now);
  const enrolled = (profile?.enrolledCourses || []).filter((c) => c.day && c.period);
  if (enrolled.length === 0) {
    return '次の授業の教室を調べるには、今期の時間割をカルテに登録してくださいね。「1限は3505、2限は122」のように教室を2つ送ってもらえれば、移動と早めの入室も判定できますよ。';
  }
  const current = resolvePeriodAt(clock.minutes);
  const from = current.period === null ? 6 : current.status === 'class' ? current.period + 1 : current.period;
  const next = enrolled
    .filter((c) => c.day === clock.day && (c.period as number) >= from)
    .sort((a, b) => (a.period as number) - (b.period as number))[0];
  if (!next) {
    return `今日（${clock.day}曜日）は、この後に登録されている授業はありません。`;
  }
  const period = next.period as number;
  const room = (String(next.room || '').normalize('NFKC').match(ROOM_PATTERN) || [])[0]?.toUpperCase();
  const head = `次の授業は${period}限の${next.name}${room ? `（${getCompactRoomLabel(room)}）` : ''}ですね！`;
  if (!room) return `${head}\n教室がカルテに登録されていないので、教室番号を教えてもらえれば空き状況をお調べします。`;
  if (period === 1) return `${head}\n1限の前は授業がないので、早めに入って準備できますよ。`;
  const usage = findRoomUsage(room, clock.day, period - 1, semester);
  if (usage.length > 0) {
    return `${head}\n${semester}の${clock.day}曜${period - 1}限は、その教室で${usage[0].name}（${usage[0].teacher}先生）が行われているので、終わるまでは入室できません。`;
  }
  if (period === 3) {
    return `${head}\n2限はその教室に授業が入っていないので、お昼休みから入って昼食や自習に使えますよ。`;
  }
  return `${head}\n${semester}の${clock.day}曜${period - 1}限はその教室に授業が入っていないので、早めに入って自習もできそうですよ。`;
}

// 自分の予定（今日・明日・曜日ごと・次の授業・今期の時間割全体）を、カルテの今期の時間割から答える
function answerMySchedule(q: string, profile: UserProfileData | null | undefined, now: Date, day: string | undefined): string {
  const clock = getCampusClock(now);
  const week = ['日', ...DAYS];
  const enrolled = (profile?.enrolledCourses || [])
    .map((c) => ({ name: c.name, room: c.room, day: String(c.day || '').replace(/曜.*$/, ''), period: Number(c.period) }))
    .filter((c) => c.name && DAYS.includes(c.day) && Number.isInteger(c.period))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.period - b.period);
  if (enrolled.length === 0) {
    return '今期の時間割がカルテに登録されていないので、まだお答えできません。プロフィールの「今期履修中」で時間割の画像やPDFを読み込むと、今日の授業や次の授業をお答えできますよ。';
  }
  const time = (period: number) => PERIOD_TIMES.find((p) => p.period === period);
  const line = (c: (typeof enrolled)[number]) => `${c.period}限（${time(c.period)?.label ?? ''}） ${c.name}${c.room ? `（${c.room}）` : ''}`;
  const short = (c: (typeof enrolled)[number]) => `${c.day}曜${c.period}限の${c.name}${c.room ? `（${c.room}）` : ''}`;
  // 今から後で最初の授業（今日の残り → 次の日以降、1週間先まで）
  const nextClass = () => {
    const today = week.indexOf(clock.day);
    for (let i = 0; i < 7; i++) {
      const d = week[(today + i) % 7];
      const found = enrolled.find((c) => c.day === d && (i > 0 || (time(c.period)?.start ?? 0) > clock.minutes));
      if (found) return { course: found, when: i === 0 ? '今日の' : i === 1 ? '明日の' : '' };
    }
    return null;
  };

  if (!day) {
    if (/次/.test(q)) {
      const next = nextClass();
      return next ? `次の授業は、${next.when}${short(next.course)}です（${time(next.course.period)?.label}）。` : '今期の時間割に、この後の授業は登録されていません。';
    }
    const days = DAYS.filter((d) => enrolled.some((c) => c.day === d));
    return [`今期の時間割は${enrolled.length}コマです。`, ...days.map((d) => `${d}曜: ${enrolled.filter((c) => c.day === d).map((c) => `${c.period}限 ${c.name}${c.room ? `（${c.room}）` : ''}`).join('、')}`)].join('\n');
  }

  const label = q.includes('明後日') ? `明後日（${day}曜日）` : q.includes('明日') ? `明日（${day}曜日）` : day === clock.day ? `今日（${day}曜日）` : `${day}曜日`;
  const list = enrolled.filter((c) => c.day === day);
  if (list.length === 0) {
    const next = day === clock.day ? nextClass() : null;
    return `${label}は、今期の時間割に登録されている授業はありません。${next ? `次の授業は${next.when}${short(next.course)}です。` : ''}`;
  }
  const lines = [`${label}の授業は${list.length}コマです。`, ...list.map(line)];
  if (day === clock.day) {
    const current = list.find((c) => (time(c.period)?.start ?? 0) <= clock.minutes && clock.minutes < (time(c.period)?.end ?? 0));
    const rest = list.filter((c) => (time(c.period)?.start ?? 0) > clock.minutes);
    const last = list[list.length - 1];
    if (current) lines.push(`今は${current.period}限の${current.name}の時間です。${rest[0] ? `次は${rest[0].period}限の${rest[0].name}です。` : 'これが今日最後の授業です。'}`);
    else if (rest[0]) lines.push(`この後は${rest[0].period}限の${rest[0].name}${rest[0].room ? `（${rest[0].room}）` : ''}からです。`);
    else lines.push(`今日の授業はすべて終わりました（${last.period}限まで）。`);
  }
  return lines.join('\n');
}

function listRows(rows: LectureCourse[], limit = 8): string {
  const lines = rows.slice(0, limit).map(describeCourseRow);
  if (rows.length > limit) lines.push(`ほかにも${rows.length - limit}件あります。学期や学科を指定してもらえれば絞り込めますよ。`);
  return lines.join('\n');
}

// =========================================================================
// 友達との空きコマ照合
// =========================================================================
export function parseSlotsFromText(text: string, db: LectureCourse[], semester: Semester): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const normalized = text.normalize('NFKC');
  // 「月1」「月曜2限」「火曜の3・4限」に対応する
  const pattern = /([月火水木金土])(?:曜日?)?の?\s*([1-5](?:\s*[・,、と]\s*[1-5])*)\s*(?:時限|限|コマ)?/g;
  for (const match of normalized.matchAll(pattern)) {
    (match[2].match(/[1-5]/g) || []).forEach((p) => slots.push({ day: match[1], period: parseInt(p, 10) }));
  }
  // 開講時間が1つに決まる科目名は、そのコマとして扱う
  findCourseNamesInText(normalized, db).forEach((name) => {
    const sections = groupIntoSections(findCourseRows(db, name).filter((c) => isInSemester(c, semester) && !isRetakeClass(c)));
    if (sections.length === 1) slots.push(...sections[0].slots);
  });
  return slots;
}

export function findCommonFreeSlots(mine: TimeSlot[], friend: TimeSlot[]): TimeSlot[] {
  const busy = new Set([...mine, ...friend].map((s) => `${s.day}${s.period}`));
  const includeSaturday = [...mine, ...friend].some((s) => s.day === '土');
  const free: TimeSlot[] = [];
  DAYS.filter((d) => d !== '土' || includeSaturday).forEach((day) => {
    [1, 2, 3, 4, 5].forEach((period) => {
      if (!busy.has(`${day}${period}`)) free.push({ day, period });
    });
  });
  return free;
}

function answerFriendSlots(q: string, profile: UserProfileData | null | undefined, db: LectureCourse[], semester: Semester): string {
  const split = q.search(/友達|友だち|ともだち|友人|フレンド/);
  const before = split > 0 ? q.slice(0, split) : '';
  const after = split >= 0 ? q.slice(split) : q;
  const friendSlots = parseSlotsFromText(after, db, semester);
  const textSlots = parseSlotsFromText(before, db, semester);
  const enrolled: TimeSlot[] = (profile?.enrolledCourses || [])
    .filter((c) => c.day && c.period)
    .map((c) => ({ day: c.day as string, period: c.period as number }));
  const mine = textSlots.length > 0 ? textSlots : enrolled;

  if (friendSlots.length === 0) {
    return '友達との空きコマを照らし合わせますね！お互いの授業が入っているコマを教えてください。たとえば「私は月1、火2、水3。友達は月2、火2、木4」のように送ってもらえれば、共通で空いている時間をお探ししますよ。自分の時間割をカルテに登録済みなら、友達の分だけで大丈夫です。';
  }
  if (mine.length === 0) {
    return '友達の授業が入っているコマは読み取れました！ご自身の時間割がまだ分からないので、「私は月1、火2」のように教えてもらうか、時間割をカルテに登録してみてくださいね。';
  }

  const free = findCommonFreeSlots(mine, friendSlots);
  if (free.length === 0) {
    return '残念ながら、お二人が共通で空いているコマは見つかりませんでした。お昼休み（12時10分から13時）なら一緒に過ごせそうですよ。';
  }
  const days = Array.from(new Set(free.map((s) => s.day)));
  const lines = ['お二人の時間割を照らし合わせました！共通で空いているコマはこちらです。', ''];
  days.forEach((day) => {
    lines.push(`${day}曜日は${free.filter((s) => s.day === day).map((s) => `${s.period}限`).join('、')}が空いていますよ。`);
  });
  lines.push('', 'お昼休み（12時10分から13時）も合わせて、集まる時間の参考にしてみてくださいね。');
  return lines.join('\n');
}

// =========================================================================
// 質問の振り分け
// =========================================================================
export function answerTimetableQuery(query: string, profile?: UserProfileData | null, now: Date = new Date()): string | null {
  const q = query.normalize('NFKC').trim();
  if (!q) return null;
  const clock = getCampusClock(now);
  const explicitSemester = parseSemester(q);
  const semester = explicitSemester || clock.semester;
  const curriculum = profile?.admissionYear;
  const db = getLectureDatabase(curriculum);
  const student = toStudent(profile, semester);
  const rooms = parseRooms(q);
  const day = parseDay(q, now);
  const period = parsePeriod(q);

  // 友達との空きコマ照合
  if (/友達|友だち|ともだち|友人|フレンド/.test(q) && /空き|空い|共通|時間割|コマ/.test(q)) {
    return answerFriendSlots(q, profile, db, semester);
  }

  // キャンパス移動
  if (rooms.length >= 2 && /移動|間に合|ルート|行き方|10分|から|->|→/.test(q)) {
    const toPeriodMatches = [...q.matchAll(/([1-5])\s*(?:時限|限)/g)];
    const toPeriod = toPeriodMatches.length > 0 ? parseInt(toPeriodMatches[toPeriodMatches.length - 1][1], 10) : undefined;
    return calculateTransitOptimization(rooms[0], rooms[1], { day: day || clock.day, period: toPeriod, semester });
  }

  // 次の授業の教室に早めに入れるか
  if (/早めに|早く|先に(行|入)|前もって/.test(q) && /次|授業/.test(q) && /教室|入室|入れ|自習/.test(q) && rooms.length === 0) {
    return answerEarlyEntry(profile, now, semester);
  }

  // 時間割の重複チェック
  if (/被っ|かぶっ|カブっ|重複|バッティング|重なっ|重なら|重なる/.test(q)) {
    const names = findCourseNamesInText(q, db);
    const enrolled = (profile?.enrolledCourses || []).map((c) => c.name);
    const targets = Array.from(new Set(names.length === 1 ? [...names, ...enrolled] : names));
    if (targets.length >= 2) {
      return checkCourseConflicts(targets, curriculum, { department: profile?.department, grade: profile?.grade, semester: explicitSemester }).formattedReport;
    }
    return '重複をチェックしたい科目を2つ以上教えてくださいね。たとえば「情報リテラシーと線形代数1は重なる？」のように送ってもらえれば、すぐにお調べします。';
  }

  // 必修組み込み済みの自動スケジュール提案
  if (/時間割(を)?(作|組|考|提案)|スケジュール(を)?作|おすすめの時間割|必修時間割|基本時間割|履修パターン|履修計画|時間割(の)?(案|パターン)/.test(q)
    || (/必修/.test(q) && /時間割|スケジュール/.test(q) && /入れ|網羅|組み込|にして|まとめ/.test(q))) {
    const department = profile?.department;
    if (!department) {
      return '時間割を組むには所属学科と学年が必要です。カルテにプロフィールを登録するか、「情報科学科1年の時間割を作って」のように教えてくださいね。';
    }
    const grade = profile?.grade || 1;
    const required = (GAKUBU_YORAN_DEPARTMENTS[department]?.requiredCourses || [])
      .filter((c) => !c.year || c.year === grade)
      .map((c) => c.name);
    return proposeAutomaticSchedule(department, grade, curriculum, required, semester, student.takenCourses);
  }

  // 空きコマの活用提案
  const asksFreeRoom = /空き教室|空いてる教室|空いている教室|自習室|自習スポット|自習できる|教室空い|教室は空|空き部屋|空いてる場所|使える教室/.test(q);
  if (!asksFreeRoom && /空きコマ|空いてるコマ|空いているコマ|コマを埋め|埋めたい|コマに入る|(空いてる|空いている)(から|ので)|単位が足りない(から|ので)|履修できる|履修可能/.test(q)) {
    const category = q.includes('総合') ? '総合' : q.includes('外国語') ? '外国語' : q.includes('基礎') ? '基礎' : undefined;
    if (day && period) {
      return suggestCoursesForFreePeriod(day, period, category, curriculum, student);
    }
    const enrolled = (profile?.enrolledCourses || []).filter((c) => c.day && c.period);
    if (enrolled.length === 0) {
      return '空きコマに入る授業をお探ししますね！「火曜3限が空いている」のように曜日と時限を教えてもらうか、今期の時間割をカルテに登録してもらえれば、提案できますよ。';
    }
    const busy = new Set(enrolled.map((c) => `${c.day}${c.period}`));
    const slots = DAYS.slice(0, 5).flatMap((d) => [2, 3, 4].map((p) => ({ day: d, period: p }))).filter((s) => !busy.has(`${s.day}${s.period}`)).slice(0, 3);
    if (slots.length === 0) {
      return '平日の2限から4限はすでに授業で埋まっているようです。空いているコマを指定してもらえれば、お調べしますよ。';
    }
    return slots.map((s) => suggestCoursesForFreePeriod(s.day, s.period, category, curriculum, student)).join('\n\n');
  }

  // 教室の使用状況（教室番号が入った質問）
  if (rooms.length === 1 && (asksFreeRoom || /何限|予定|利用|使われ|使用|授業|空いて|空い|スケジュール|誰|何の/.test(q))) {
    if (day && period) return describeRoomSlot(rooms[0], day, period, semester, now);
    return getRoomDailySchedule(rooms[0], day, semester, now);
  }

  // 空き教室検索
  const nowLike = /今|いま|現在/.test(q) && /空い|自習/.test(q);
  if (asksFreeRoom || nowLike) {
    const building = q.match(/([12347])\s*号館/);
    const buildingLabel = building ? `${building[1]}号館` : undefined;
    let targetPeriod = period ?? parseClockPeriod(q);
    let targetDay = day;
    if (/次の?(?:コマ|時限|授業)/.test(q) && targetPeriod === undefined) {
      const current = resolvePeriodAt(clock.minutes);
      targetPeriod = current.status === 'class' ? (current.period as number) + 1 : current.period ?? undefined;
      if (targetPeriod !== undefined && targetPeriod > 5) targetPeriod = undefined;
    }
    if (targetDay === undefined && targetPeriod !== undefined) targetDay = clock.day;
    return findFreeRooms(targetDay, targetPeriod, buildingLabel, explicitSemester, now).formattedReport;
  }

  // 自分の予定（「今日の授業は？」「明日の時間割」「次の授業は？」「私の時間割」）。科目・先生・教室の名前があれば逆引きにする
  const asksOwnSchedule =
    /(自分|私|わたし|僕|ぼく|俺|うち)の(時間割|授業|予定)|今期の時間割|履修中の(授業|科目)/.test(q) ||
    (/今日|本日|明日|明後日|[月火水木金土]曜/.test(q) && /授業|講義|時間割|予定|何限から|何限まで|終わる|コマ/.test(q) && period === undefined) ||
    /^次の?(授業|講義)(は|って)?(何|なに|いつ|どこ|何時)?/.test(q);
  if (asksOwnSchedule && rooms.length === 0 && findTeachersInText(q, db).length === 0 && findCourseNamesInText(q, db).length === 0) {
    return answerMySchedule(q, profile, now, day);
  }

  // 科目・教員の逆引き。科目名があれば、問いかけの言葉がなくても（「〇〇は月曜4限？」）答える
  const lookup: LookupOptions = { day, period, explicitSemester, semester, department: profile?.department };
  const ownBest = rankCourseNames(q, db)[0];
  const otherBest = rankCourseNames(q, getLectureDatabase(otherCurriculum(curriculum)))[0];
  const asksLookup =
    /先生|教授|講師|授業|講義|科目|いつ|何曜|何限|どの教室|どこで|教室は|開講|担当/.test(q) ||
    (!!(ownBest || otherBest) && (day !== undefined || period !== undefined || /[?？]$|ある|やって|取れ|どこ|何時/.test(q))) ||
    // 問いかけの言葉がなくても、科目名がはっきり出ていれば答える（「〇〇について教えて」「〇〇を取りたい」、名前だけ）。
    // 卒業要件・GPA・資格コースなどの話（「〇〇を落とした」）は、ローカル応答のほかの答えに任せる
    (!OTHER_TOPIC.test(q) &&
      (mentionedCourses(q, db).length > 0 || mentionedCourses(q, getLectureDatabase(otherCurriculum(curriculum))).length > 0));
  if (asksLookup) {
    const teachers = findTeachersInText(q, db);
    if (teachers.length > 0) {
      const rows = db.filter((c) => teachers.some((t) => teacherList(c).includes(t)) && (!explicitSemester || isInSemester(c, semester)));
      if (rows.length > 0) {
        return `${teachers.join('、')}先生の授業をお調べしました！\n\n${listRows(rows)}`;
      }
    }
    // もう一方のカリキュラムのほうが長く一致する（その名前の科目はもう一方にしかない）ときは、そちらを案内する。
    // 例：令和6年度以前の人の「アルゴリズムとデータ構造」は、自分の時間割の「アルゴリズム」ではなく令和7年度以降の科目
    if (otherBest && (!ownBest || otherBest.common > ownBest.common)) {
      const other = answerFromOtherCurriculum(q, curriculum, lookup, otherBest);
      if (other) return other;
    }
    const names = findCourseNamesInText(q, db);
    if (names.length > 0) {
      const exactNames = new Set(rankCourseNames(q, db).filter((m) => m.exact).map((m) => m.name));
      // 「データ構造とアルゴリズム」のように2つの科目の名前があれば、両方答える（3つまで）
      const answers = names
        .slice(0, 3)
        .map((name) => describeNamedCourse(name, db, exactNames.has(name), lookup))
        .filter((a): a is string => !!a);
      if (answers.length > 0) return answers.join('\n\n');
    }
    // 曜日と時限だけを指定して開講科目を聞く質問
    if (day && period && /授業|講義|開講|科目/.test(q)) {
      return suggestCoursesForFreePeriod(day, period, undefined, curriculum, student);
    }
    const other = answerFromOtherCurriculum(q, curriculum, lookup);
    if (other) return other;
  }

  return null;
}

// Geminiに渡す参照データ。検索結果があれば事実はこの内容に限定させる
const PROGRAM_WORDS = /副専攻|コース|学科|専攻|教職/;
const OTHER_TOPIC = /副専攻|コース|学科|専攻|教職|要件|卒業|進級|GPA|単位|必修|違い|落と|再履修|成績|評価/i;

const otherCurriculum = (curriculum?: string) => (curriculum === 'reiwa6_or_earlier' ? 'reiwa7_or_later' : 'reiwa6_or_earlier');

/**
 * 文章にはっきり出ている科目名（3つまで）。学科・コース・副専攻の名前の一部（「情報科学科」の「情報科学」）や、
 * 3文字以下の短い名前（「英語」）は、問いかけの言葉がないときに拾いすぎるので数えない
 */
function mentionedCourses(q: string, db: LectureCourse[]): string[] {
  const text = compactQuery(q);
  const best = rankCourseNames(q, db)[0];
  return findCourseNamesInText(q, db)
    .filter((name) => {
      // 少し違う書き方（2文字の組の75%以上が一致）。「データサイエンス副専攻」を「データサイエンス入門」と取り違えないよう、学科・コースの話では使わない
      if (!text.includes(name)) return best?.name === name && !PROGRAM_WORDS.test(text);
      if (name.length < 4) return false;
      return text.split(name).slice(1).some((after) => !/^(学?科|専攻|コース|副専攻|分野|群|カテゴリ)/.test(after));
    })
    .slice(0, 3);
}

// 要覧（学科の必修・選択必修の表）での区分。プロフィールの学科を先に探す
function describeCurriculumEntry(name: string, department?: string): string[] {
  const departments = Object.values(VERIFIED_12_DEPARTMENTS_CURRICULUM).sort(
    (a, b) => Number(b.department === department) - Number(a.department === department)
  );
  const lines: string[] = [];
  departments.forEach((d) => {
    [...d.requiredCourses, ...d.electiveRequiredCourses]
      .filter((c) => baseCourseName(c.name) === name)
      .forEach((c) => {
        const parts = [`${d.department}の${c.category}`, c.group, c.year ? `${c.year}年次配当` : '', `${c.credits}単位`].filter(Boolean);
        lines.push(`・要覧: ${parts.join('、')}${c.note ? `（${c.note}）` : ''}`);
      });
  });
  return lines.slice(0, 3);
}

/**
 * 質問に出てきた科目の「要覧での区分」と「令和8年度の開講コマ（学期・曜日・時限・教員・教室）」をセットにする。
 * 区分だけを知って開講コマを推測しないように、Geminiへの参照データには必ずこれを付ける
 */
export function describeMentionedCourses(query: string, profile?: UserProfileData | null): string | null {
  const q = query.normalize('NFKC').trim();
  if (!q) return null;
  const mine = profile?.admissionYear === 'reiwa6_or_earlier' ? 'reiwa6_or_earlier' : 'reiwa7_or_later';
  const other = otherCurriculum(mine);
  const ownDb = getLectureDatabase(mine);
  const otherDb = getLectureDatabase(other);
  const names = mentionedCourses(q, ownDb);
  mentionedCourses(q, otherDb).forEach((n) => {
    if (names.length < 3 && !names.some((m) => m.includes(n))) names.push(n);
  });
  if (names.length === 0) return null;
  const blocks = names.map((name) => {
    const lines = [`「${name}」`, ...describeCurriculumEntry(name, profile?.department)];
    const ownRows = findCourseRows(ownDb, name);
    if (ownRows.length > 0) {
      lines.push(`・開講（${CURRICULUM_LABEL[mine]}の時間割）:`, listRows(ownRows, 12));
    } else {
      const otherRows = findCourseRows(otherDb, name);
      lines.push(
        otherRows.length > 0
          ? `・${CURRICULUM_LABEL[mine]}の時間割にはありません。${CURRICULUM_LABEL[other]}の時間割での開講:\n${listRows(otherRows, 12)}`
          : '・令和8年度の時間割に開講はありません。'
      );
    }
    return lines.join('\n');
  });
  return blocks.join('\n\n');
}

export function buildTimetableContext(query: string, profile?: UserProfileData | null, now: Date = new Date()): string {
  const clock = getCampusClock(now);
  const answer = answerTimetableQuery(query, profile, now);
  const header = `【時間割の参照データ（システムが令和8年度の時間割から検索した結果）】\n現在日時: ${clock.label}（日本時間） / 現在の学期: ${clock.semester}\n`;
  // 科目名が出てきたら、検索の結果に関係なく、要覧での区分と開講コマをセットで渡す
  const courseFacts = describeMentionedCourses(query, profile);
  const factsBlock = courseFacts
    ? `質問に出てきた科目の基本情報（要覧での区分と、令和8年度の開講コマ）:\n${courseFacts}\n\n科目について答えるときは、区分と開講コマ（学期・曜日・時限・教員・教室）をセットで伝えてください。開講コマはこの情報以外を推測しないでください。\n`
    : '';
  if (answer) {
    // 推測の対応科目が含まれるときだけ、断定しない言い方を指示する
    const toneRule = answer.includes(COUNTERPART_NOTE) ? `${COUNTERPART_TONE_RULE}\n` : '';
    return `${header}検索結果:\n${answer}\n\n上の検索結果にある事実だけを使い、言葉遣いを整えて回答してください。\n${toneRule}${factsBlock ? `\n${factsBlock}` : ''}\n`;
  }
  if (factsBlock) return `${header}${factsBlock}\n`;
  return `${header}この質問に対応する検索結果はありません。特定の授業、教員、教室、時限についての事実を聞かれた場合は推測せず、該当する曜日や時限、科目名を聞き返してください。\n\n`;
}
