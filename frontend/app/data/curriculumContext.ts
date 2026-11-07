// 資格コース・教職・副専攻の質問に、学部要覧の表から書き写したデータを渡す（AIに科目名や単位数を推測させない）
import {
  CourseOrMinorItem,
  GroupRule,
  MINOR_SYSTEM_RULES,
  VERIFIED_COURSES_CURRICULUM,
  VERIFIED_MINORS_CURRICULUM
} from './coursesAndMinorsCurriculum';
import { getTeachingLicenses, LICENSE_REQUIRED_CREDITS, TEACHING_LICENSES, TeachingLicenseDef, UNIVERSITY_ORIGINAL_COURSES } from './teachingLicenseCurriculum';

// 要覧 p.178-179「文理学部で取得できるその他の資格・受験資格・任用資格」
export const OTHER_QUALIFICATIONS: { name: string; kind: string; detail: string }[] = [
  { name: '社会福祉士', kind: '受験資格', detail: '社会福祉学科のみ。社会福祉学科はスクール（学校）ソーシャルワーク教育課程の認定校' },
  { name: 'JATI認定トレーニング指導者', kind: '受験資格', detail: '体育学科専門科目の指定単位を修得すると、日本トレーニング指導者協会の認定試験を受けられる' },
  { name: '公認心理師', kind: '受験資格', detail: '心理学科公認心理師コースのみ。所定の科目を修得して卒業後、対応する大学院の修了又は一定の施設での実務経験で受験資格' },
  { name: '甲種危険物取扱者', kind: '受験資格', detail: '化学科のみ。化学科を卒業、又は化学に関する授業科目を15単位以上修得で受験資格' },
  { name: 'キャンプインストラクター', kind: '講習・試験の一部免除', detail: '体育学科「野外実習（キャンプ）」を修得し申請すると認定試験を受けられる' },
  { name: '日本サッカー協会公認C級コーチ', kind: '講習・試験の一部免除', detail: '体育学科「スポーツ実習（サッカー）」「スポーツ方法論（サッカー）」「スポーツ指導法（サッカー）」を修得し申請' },
  { name: '初級障がい者スポーツ指導員', kind: '講習・試験の一部免除', detail: '体育学科「アダプテッドスポーツ論」を修得し申請' },
  { name: '日本スポーツ協会 共通科目免除', kind: '講習・試験の一部免除', detail: '指定の体育学科専門科目の修得で卒業後に共通科目が免除。アシスタントマネジャー資格を受験でき、合格すれば卒業と同時に取得' },
  { name: '水泳コーチ3', kind: '講習・試験の一部免除', detail: '共通科目免除の申請に加え、「スポーツ実習（水泳）」「スポーツ方法論（水泳）」「野外実習（オーシャンスポーツ）」を修得し申請' },
  { name: '社会調査士', kind: '卒業後に申請', detail: '社会学科のみ' },
  { name: '認定心理士・認定心理士（心理調査）', kind: '卒業後に申請', detail: '心理学科のみ。日本心理学会の認定' },
  { name: '地域調査士', kind: '卒業後に申請', detail: '地理学科のみ' },
  { name: 'GIS学術士', kind: '卒業後に申請', detail: '地理学科のみ' },
  { name: '技術士補', kind: '卒業後に申請', detail: '地球科学科の地球環境学プログラム修了者が日本技術士会に登録' },
  { name: '測量士補', kind: '卒業後に申請', detail: '地理学科・地球科学科・数学科・物理学科の卒業者が国土地理院に申請' },
  { name: '毒物劇物取扱責任者', kind: '卒業後に申請', detail: '化学科の卒業者' },
  { name: 'スクールソーシャルワーカー', kind: '卒業後に申請', detail: '社会福祉学科のみ' },
  { name: '社会福祉主事', kind: '任用資格', detail: '指定科目を修得して卒業し、公務員などに採用されて業務に就くと得られる' },
  { name: '児童福祉司', kind: '任用資格', detail: '社会学科・社会福祉学科・教育学科・心理学科' },
  { name: '身体障害者福祉司', kind: '任用資格', detail: '社会福祉学科' }
];

const names = (list: CourseOrMinorItem[]) =>
  list.map((c) => `${c.name}（${c.credits}単位${c.note ? `・${c.note}` : ''}${c.aliases?.length ? `・${c.aliases.join('/')}で読み替え` : ''}）`).join('、');

function describeGroups(rules: GroupRule[] | undefined, electives: CourseOrMinorItem[]): string[] {
  const lines: string[] = [];
  const inRules = new Set((rules || []).map((r) => r.group));
  for (const rule of rules || []) {
    const members = electives.filter((c) => c.group === rule.group);
    lines.push(`・条件「${rule.label}」：${names(members)}`);
  }
  const free = electives.filter((c) => !inRules.has(c.group || ''));
  if (free.length > 0) lines.push(`・選択科目（合計単位に数える）：${names(free)}`);
  return lines;
}

function describeCourse(name: string): string {
  const c = VERIFIED_COURSES_CURRICULUM[name];
  return [
    `■${c.name}（要覧 ${c.page}・窓口 ${c.window}）対象：${c.target}`,
    `・修了要件：${c.description}`,
    c.requiredCourses.length > 0 ? `・必修：${names(c.requiredCourses)}` : '',
    ...describeGroups(c.groupRules, c.electiveRequiredCourses),
    ...(c.notes || []).map((n) => `・注意：${n}`)
  ].filter(Boolean).join('\n');
}

function describeMinor(name: string): string {
  const m = VERIFIED_MINORS_CURRICULUM[name];
  return [
    `■${m.name}（要覧 ${m.page}・${m.type === 'department' ? `学科副専攻（幹事：${m.targetDept}。${m.targetDept}の学生は修了認定不可）` : '学際副専攻'}・窓口 ${m.window}）`,
    `・修了要件：${m.description}`,
    m.requiredCourses.length > 0 ? `・必修：${names(m.requiredCourses)}` : '',
    ...describeGroups(m.groupRules, m.electiveRequiredCourses),
    ...(m.notes || []).map((n) => `・注意：${n}`)
  ].filter(Boolean).join('\n');
}

export function describeLicense(l: TeachingLicenseDef): string {
  return [
    `■${l.department}【${l.subject}】${l.levels.join('・')}（要覧 ${l.page}）必要単位数：${l.levels.map((lv) => `${lv}${LICENSE_REQUIRED_CREDITS[lv]}単位`).join('、')}`,
    l.requiredCourses.length > 0 ? `・網掛けの必修：${names(l.requiredCourses)}` : '',
    ...describeGroups(l.groupRules, l.electiveRequiredCourses),
    `・各教科教育法：${l.methodCourses.join('、')}`,
    ...l.notes.map((n) => `・注意：${n}`),
    `・網掛けでない選択科目と大学が独自に設定する科目（${UNIVERSITY_ORIGINAL_COURSES.join('、')}）も必要単位数に数えられる`
  ].filter(Boolean).join('\n');
}

// 質問の言い方からコースを探す
const COURSE_KEYWORDS: [string, string[]][] = [
  ['教職コース', ['教職', '教員免許', '教育実習', '教科教育法', '中学校の免許', '高校の免許', '先生になり', '教師になり']],
  ['特別支援学校教諭免許状', ['特別支援学校', '特支']],
  ['司書教諭コース', ['司書教諭']],
  ['司書コース', ['司書コース', '図書館司書']],
  ['学芸員コース', ['学芸員', '博物館実習']],
  ['社会教育主事コース', ['社会教育主事', '社会教育士']],
  ['日本語教育コース', ['日本語教育', '日本語教師', '登録日本語教員']]
];

export function findCoursesInQuery(query: string): string[] {
  const q = query || '';
  return COURSE_KEYWORDS
    .filter(([name, words]) => q.includes(name) || words.some((w) => q.includes(w)))
    // 「司書教諭」は司書コースの質問ではない
    .filter(([name]) => !(name === '司書コース' && q.includes('司書教諭') && !q.includes('司書コース')))
    .map(([name]) => name);
}

export function findMinorsInQuery(query: string): string[] {
  const q = query || '';
  return Object.keys(VERIFIED_MINORS_CURRICULUM).filter((name) => {
    if (q.includes(name)) return true;
    const short = name.replace('副専攻', '');
    return q.includes('副専攻') && short.length >= 2 && q.includes(short);
  });
}

// 教職の表がある学科に、表のない2学科を足した全18学科
const DEPARTMENTS = [...new Set(TEACHING_LICENSES.map((l) => l.department)), '社会福祉学科', '心理学科'];

/** Geminiのプロンプトに添える要覧データ。該当がなければ空文字 */
export function buildCurriculumContext(query: string, profile?: { department?: string; selectedCourses?: string[]; selectedMinors?: string[] } | null): string {
  const q = query || '';
  const courses = findCoursesInQuery(q);
  const minors = findMinorsInQuery(q);
  const asksMinorSystem = q.includes('副専攻') && minors.length === 0;
  const asksOther = ['資格', '受験資格', '任用資格', '社会福祉士', '公認心理師', '危険物', '測量士', '社会調査士', '認定心理士', 'GIS', '技術士', '毒物劇物', 'コーチ', 'JATI'].some((w) => q.includes(w));
  if (courses.length === 0 && minors.length === 0 && !asksMinorSystem && !asksOther) return '';

  const sections: string[] = [];
  for (const name of courses) {
    sections.push(describeCourse(name));
    if (name === '教職コース') {
      // 質問に学科名があればその学科、なければ本人の所属学科の教科専門科目
      const dept = DEPARTMENTS.find((d) => q.includes(d)) || profile?.department;
      const licenses = dept ? getTeachingLicenses(dept) : [];
      if (licenses.length > 0) sections.push(licenses.map(describeLicense).join('\n'));
      else if (dept) sections.push(`■${dept}：学部要覧 p.145-159 にはこの学科の教科専門科目の表はありません`);
    }
  }
  for (const name of minors) sections.push(describeMinor(name));
  if (asksMinorSystem) {
    sections.push(['■副専攻の制度（要覧 p.180-181）', ...MINOR_SYSTEM_RULES.map((r) => `・${r}`),
      `・副専攻の一覧：${Object.values(VERIFIED_MINORS_CURRICULUM).map((m) => `${m.name}（${m.type === 'department' ? `${m.targetDept}` : '学際'}）`).join('、')}`].join('\n'));
  }
  if (asksOther && courses.length === 0) {
    sections.push(['■文理学部で取得できるその他の資格（要覧 p.178-179）', ...OTHER_QUALIFICATIONS.map((o) => `・${o.name}（${o.kind}）：${o.detail}`)].join('\n'));
  }

  return `【学部要覧の参照データ（『学部要覧（令和7年度）』の表から書き写した内容）】\n${sections.join('\n\n')}\n\n` +
    '資格コース・教職・副専攻・資格の科目名、単位数、条件は上の参照データにある内容だけを使って答えてください。参照データにない科目や条件を作らず、分からないことは窓口で確認するよう案内してください。\n\n';
}

// ---- APIキーがないときのローカル応答（LINEのような会話文。記号や見出しは使わない） ----
const joinNames = (list: { name: string }[]) => list.map((c) => c.name).join('、');
const ASK_WORDS = ['必修', '科目', '単位', '要件', '条件', '取り方', '必要', '修了', '免許', '教えて', 'とは', 'って何'];

export function answerCurriculumLocally(query: string, profile?: { department?: string } | null): string | null {
  const q = query || '';
  const courses = findCoursesInQuery(q);
  const minors = findMinorsInQuery(q);

  if (courses.length > 0 && ASK_WORDS.some((w) => q.includes(w))) {
    const c = VERIFIED_COURSES_CURRICULUM[courses[0]];
    const parts = [`${c.name}は、${c.description}。`];
    if (c.requiredCourses.length > 0 && c.requiredCourses.length <= 16) parts.push(`必修科目は${joinNames(c.requiredCourses)}です。`);
    else if (c.requiredCourses.length > 0) parts.push(`必修科目は${c.requiredCourses.length}科目あり、${joinNames(c.requiredCourses.slice(0, 8))}などです。`);
    if (c.groupRules?.length) parts.push(`ほかに${c.groupRules.map((r) => r.label).join('、')}という条件があります。`);
    if (c.name === '教職コース') {
      const dept = DEPARTMENTS.find((d) => q.includes(d)) || profile?.department;
      const licenses = dept ? getTeachingLicenses(dept) : [];
      for (const l of licenses) {
        const groups = l.groupRules.length ? `、さらに${l.groupRules.map((r) => r.label).join('、')}` : '';
        parts.push(`${dept}で取れる${l.subject}（${l.levels.join('・')}）では、教科の専門科目として${joinNames(l.requiredCourses)}が必修${groups}が必要です。`);
      }
      if (dept && licenses.length === 0) parts.push(`${dept}の教科専門科目の表は要覧にないので、教職センターで確認してくださいね。`);
    }
    if (c.notes?.[0]) parts.push(`${c.notes[0].replace(/。$/, '')}。`);
    parts.push(`窓口は${c.window}で、学部要覧の${c.page}に載っていますよ。`);
    return parts.join('');
  }

  if (minors.length > 0) {
    const m = VERIFIED_MINORS_CURRICULUM[minors[0]];
    const parts = [`${m.name}は、${m.description}。`];
    if (m.requiredCourses.length > 0) parts.push(`必修科目は${joinNames(m.requiredCourses)}です。`);
    if (m.groupRules?.length) parts.push(`科目の条件として${m.groupRules.map((r) => r.label).join('、')}が必要です。`);
    if (m.notes?.[0]) parts.push(`${m.notes[0].replace(/。$/, '')}。`);
    parts.push(m.type === 'department'
      ? `${m.targetDept}の学生はこの副専攻の修了認定を受けられないので気をつけてくださいね。相談は${m.window}で、学部要覧の${m.page}に載っていますよ。`
      : `どの学科の学生も修了認定を受けられる学際副専攻で、相談は${m.window}です。学部要覧の${m.page}に載っていますよ。`);
    return parts.join('');
  }
  return null;
}
