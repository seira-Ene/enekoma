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
  PERIOD_TIMES,
  proposeAutomaticSchedule,
  resolvePeriodAt,
  Semester,
  StudentContext,
  suggestCoursesForFreePeriod
} from './courses';
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
  const shorthand = q.match(/([月火水木金土])\s*の?\s*[1-5]\s*(?:限|時限|コマ)/);
  return shorthand ? shorthand[1] : undefined;
}

function parsePeriod(q: string): number | undefined {
  const named = q.match(/([1-5])\s*(?:時限|限|コマ)/);
  return named ? parseInt(named[1], 10) : undefined;
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

// 文章に含まれる科目名を長い名前から順に取り出す
function findCourseNamesInText(q: string, db: LectureCourse[]): string[] {
  let rest = q.normalize('NFKC').replace(/\s+/g, '');
  const names = Array.from(new Set(db.map((c) => baseCourseName(c.name)))).filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  const found: string[] = [];
  names.forEach((name) => {
    if (rest.includes(name)) {
      found.push(name);
      rest = rest.split(name).join(' ');
    }
  });
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

// 今のカリキュラムの時間割に見つからない科目・先生が、もう一方のカリキュラムにあれば知らせる（推測で答えないため）
function answerFromOtherCurriculum(q: string, curriculum: string | undefined, explicitSemester: Semester | undefined, semester: Semester): string | null {
  const mine = curriculum === 'reiwa6_or_earlier' ? 'reiwa6_or_earlier' : 'reiwa7_or_later';
  const other = mine === 'reiwa7_or_later' ? 'reiwa6_or_earlier' : 'reiwa7_or_later';
  const otherDb = getLectureDatabase(other);
  const inTerm = (c: LectureCourse) => !explicitSemester || isInSemester(c, semester);
  const teachers = findTeachersInText(q, otherDb);
  let label = '';
  let rows: LectureCourse[] = [];
  if (teachers.length > 0) {
    label = `${teachers.join('、')}先生の授業`;
    rows = otherDb.filter((c) => teachers.some((t) => (c.teacher || '').split(/\s*\/\s*/).includes(t)) && inTerm(c));
  } else {
    const names = findCourseNamesInText(q, otherDb);
    if (names.length === 0) return null;
    label = `「${names[0]}」`;
    rows = findCourseRows(otherDb, names[0]).filter(inTerm);
  }
  if (rows.length === 0) return null;
  return [
    `${label}は、${CURRICULUM_LABEL[mine]}の時間割にはありませんでした。`,
    `${CURRICULUM_LABEL[other]}の時間割には次のように載っています。`,
    '',
    listRows(rows),
    '',
    'プロフィールの入学年度が違っていたら、基本設定の「入学年度」を変えてからもう一度聞いてくださいね。'
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

  // 科目・教員の逆引き
  if (/先生|教授|講師|授業|講義|いつ|何曜|何限|どの教室|どこで|教室は|開講|担当/.test(q)) {
    const teachers = findTeachersInText(q, db);
    if (teachers.length > 0) {
      const rows = db.filter((c) => teachers.some((t) => (c.teacher || '').split(/\s*\/\s*/).includes(t)) && (!explicitSemester || isInSemester(c, semester)));
      if (rows.length > 0) {
        return `${teachers.join('、')}先生の授業をお調べしました！\n\n${listRows(rows)}`;
      }
    }
    const names = findCourseNamesInText(q, db);
    if (names.length > 0) {
      const rows = findCourseRows(db, names[0]).filter((c) => (!explicitSemester || isInSemester(c, semester)));
      const own = profile?.department ? rows.filter((c) => !c.targets?.length || c.targets.includes(profile.department)) : rows;
      const shown = own.length > 0 ? own : rows;
      return `${names[0]}についてお調べしました！\n\n${listRows(shown)}`;
    }
    // 曜日と時限だけを指定して開講科目を聞く質問
    if (day && period && /授業|講義|開講/.test(q)) {
      return suggestCoursesForFreePeriod(day, period, undefined, curriculum, student);
    }
    const other = answerFromOtherCurriculum(q, curriculum, explicitSemester, semester);
    if (other) return other;
  }

  return null;
}

// Geminiに渡す参照データ。検索結果があれば事実はこの内容に限定させる
export function buildTimetableContext(query: string, profile?: UserProfileData | null, now: Date = new Date()): string {
  const clock = getCampusClock(now);
  const answer = answerTimetableQuery(query, profile, now);
  const header = `【時間割の参照データ（システムが令和8年度の時間割から検索した結果）】\n現在日時: ${clock.label}（日本時間） / 現在の学期: ${clock.semester}\n`;
  if (answer) {
    return `${header}検索結果:\n${answer}\n\n上の検索結果にある事実だけを使い、言葉遣いを整えて回答してください。\n\n`;
  }
  return `${header}この質問に対応する検索結果はありません。特定の授業、教員、教室、時限についての事実を聞かれた場合は推測せず、該当する曜日や時限、科目名を聞き返してください。\n\n`;
}
