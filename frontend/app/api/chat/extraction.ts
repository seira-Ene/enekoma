// 成績表・時間割の読み取り専用の呼び出し。会話文は書かせず、決まった形のJSONだけを返させる（Structured Outputs）
// 会話文と一緒に出させると、科目が多いほど時間がかかり、上限時間を超えて全件を失うことがあった（72科目のPDFで実測）
import { parseProfileUpdateFromText } from '@/app/data/studentAccounts';

export type ExtractionKind = 'transcript' | 'current_timetable' | 'past_timetable';

export interface MediaPart {
  mimeType: string;
  data: string; // base64（data URL の頭は外したもの）
}

/** Geminiの失敗（HTTPの状態つき）。no_courses は科目が1件も読めなかったとき */
export class ExtractionError extends Error {
  status?: number;
  code?: 'no_courses';
  constructor(message: string, status?: number, code?: 'no_courses') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// AIが返すJSON（スキーマどおりでない値も来うるので unknown で受けて確かめる）
interface RawCourse {
  name?: unknown;
  credits?: unknown;
  grade?: unknown;
  takenYear?: unknown;
  term?: unknown;
  day?: unknown;
  period?: unknown;
  room?: unknown;
  teacher?: unknown;
}
interface ExtractionJson {
  courseRowCount?: unknown;
  classCellCount?: unknown;
  courses?: unknown;
  printedTotalCredits?: unknown;
  printedGpa?: unknown;
  unreadable?: unknown;
}

export interface ExtractionResult {
  model: string;
  profileUpdate: unknown;
  reply: string;
  // 読み落としの可能性があるときの利用者向けの注意
  warning?: string;
  stats: { rowCount: number; extracted: number; attempts: number; ms: number };
}

const DAYS = ['月', '火', '水', '木', '金', '土'];

const TRANSCRIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    courseRowCount: { type: 'INTEGER', description: '画像・PDFの全ページにある科目の行の数（見出し・合計・注意書きの行は数えない）' },
    courses: {
      type: 'ARRAY',
      description: '科目の行を上から順に1行も省かずすべて',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          credits: { type: 'NUMBER' },
          grade: { type: 'STRING', description: 'S/A/B/C/D/E/F/P/N/合格 のいずれか' },
          takenYear: { type: 'INTEGER', nullable: true },
          term: { type: 'STRING', nullable: true }
        },
        required: ['name', 'credits', 'grade'],
        propertyOrdering: ['name', 'credits', 'grade', 'takenYear', 'term']
      }
    },
    printedTotalCredits: { type: 'NUMBER', nullable: true, description: '書類に印字された合計修得単位数。なければ null' },
    printedGpa: { type: 'NUMBER', nullable: true, description: '書類に印字されたGPA。なければ null' },
    unreadable: { type: 'ARRAY', items: { type: 'STRING' }, description: '文字が読めなかった行（読めた部分）。なければ空' }
  },
  required: ['courseRowCount', 'courses', 'unreadable'],
  propertyOrdering: ['courseRowCount', 'courses', 'printedTotalCredits', 'printedGpa', 'unreadable']
};

const TIMETABLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    classCellCount: { type: 'INTEGER', description: '授業が書かれたコマ（マス）の数' },
    courses: {
      type: 'ARRAY',
      description: '授業の書かれたコマを曜日・時限の順に1つも省かずすべて',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          day: { type: 'STRING', enum: DAYS },
          period: { type: 'INTEGER' },
          room: { type: 'STRING', nullable: true },
          teacher: { type: 'STRING', nullable: true },
          credits: { type: 'NUMBER', nullable: true }
        },
        required: ['name', 'day', 'period'],
        propertyOrdering: ['name', 'day', 'period', 'room', 'teacher', 'credits']
      }
    },
    unreadable: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['classCellCount', 'courses', 'unreadable'],
  propertyOrdering: ['classCellCount', 'courses', 'unreadable']
};

const COMMON_RULES = `・表に含まれるすべての行（コマ）を、上から順に1つも漏らさず抽出する。途中で省略したり（「…」「以下略」など）、上位の数件だけで切り上げたりしない。
・ページが複数ある場合や、画像が複数に分かれている場合は、すべてのページ・画像を最後まで読む。分割画像は上下が少し重なっているので、重なった部分の同じ行は1回だけ出力する。
・表の見出し（年度・学期・科目名などの列名）、学籍番号・氏名などのヘッダー、合計欄・注意書きなどのフッター、欄外の文字は科目として出力しない。
・読めない文字があっても行は省かず、読めた範囲で出力し、その行を unreadable にも書く。推測で科目を作らない。
・科目名は書類の表記どおりに書く（数字・記号・【再】などの印も含める）。`;

function instructionFor(kind: ExtractionKind): string {
  if (kind === 'transcript') {
    return `あなたは日本大学文理学部の成績通知書を読み取るOCRです。添付の成績表（写真・スクリーンショット・PDF）から科目の一覧をJSONで返してください。
${COMMON_RULES}
・評価は S/A/B/C/D/E/F にそろえる（秀→S、優→A、良→B、可→C、不可→D）。履修中止は P、認定は N、合否のみの科目は「合格」。不合格（D/E/F）の行も省かない。
・単位数は書かれた数値。書かれていなければ講義2、実験・実習・体育1。
・年度（西暦）と学期（前期/後期/通年/集中）が書かれていれば takenYear・term に入れる。
・courseRowCount には、先に表の科目の行を数えた数を入れる。courses の件数はこれと一致させる。
・合計修得単位数・GPAは印字された値だけを printedTotalCredits・printedGpa に入れ、自分で計算しない。`;
  }
  return `あなたは日本大学文理学部の時間割表を読み取るOCRです。添付の時間割（写真・スクリーンショット・PDF）から授業の一覧をJSONで返してください。
${COMMON_RULES}
・day は 月/火/水/木/金/土、period は時限の数字。1つのコマに複数の授業があれば、それぞれ1件にする。
・教室（room）と担当教員（teacher）が書かれていれば入れる。単位数が書かれていなければ null。
・classCellCount には、先に授業が書かれたコマを数えた数を入れる。courses の件数はこれと一致させる。`;
}

interface CallOptions {
  apiKey: string;
  models: string[];
  parts: MediaPart[];
  kind: ExtractionKind;
  thinkingLevel: 'minimal' | 'low' | 'medium';
  deadline: number;
}

async function callModel(model: string, opts: CallOptions, timeoutMs: number): Promise<{ json: ExtractionJson | null; finishReason?: string }> {
  const hasPdf = opts.parts.some((p) => p.mimeType === 'application/pdf');
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: instructionFor(opts.kind) },
          ...opts.parts.map((p, i) => [
            ...(opts.parts.length > 1 ? [{ text: `【画像 ${i + 1} / ${opts.parts.length}】` }] : []),
            { inlineData: { mimeType: p.mimeType, data: p.data } }
          ]).flat()
        ]
      }
    ],
    generationConfig: {
      // 読み取りは毎回同じ結果になるよう決定的にする
      temperature: 0,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: opts.kind === 'transcript' ? TRANSCRIPT_SCHEMA : TIMETABLE_SCHEMA,
      thinkingConfig: { thinkingLevel: opts.thinkingLevel },
      // PDFは既定だとページを中くらいの解像度で読むので、小さい文字のために高解像度にする
      ...(hasPdf ? { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } : {})
    }
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = (await res.json())?.error?.message || message;
    } catch {}
    throw new ExtractionError(message, res.status);
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text = ((candidate?.content?.parts || []) as { text?: string }[]).map((p) => p.text || '').join('');
  if (!text) throw new Error(`Empty response (${candidate?.finishReason || 'no candidate'})`);
  try {
    return { json: JSON.parse(text) as ExtractionJson, finishReason: candidate?.finishReason };
  } catch {
    // 出力上限で途中まで → 形式不備として扱い、呼び出し元で再試行する
    return { json: null, finishReason: candidate?.finishReason || 'INVALID_JSON' };
  }
}

/** モデルを順に試す（同時に呼ぶと無料枠を余計に使うので1つずつ） */
async function callWithFallback(opts: CallOptions): Promise<{ model: string; json: ExtractionJson | null; finishReason?: string }> {
  let lastError: unknown = null;
  for (const model of opts.models) {
    const remaining = opts.deadline - Date.now();
    if (remaining <= 1000) break;
    try {
      const { json, finishReason } = await callModel(model, opts, remaining);
      return { model, json, finishReason };
    } catch (error) {
      lastError = error;
      const status = error instanceof ExtractionError ? error.status : undefined;
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (status === 403 || message.includes('api_key') || message.includes('api key')) break;
    }
  }
  throw lastError || new Error('timeout');
}

const norm = (s: unknown) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

interface Checked {
  courses: RawCourse[];
  expected: number;
  dropped: number;
  unreadable: string[];
}

/** 形の崩れた行を除き、分割画像の重なりで2回出た行を1つにする */
function check(kind: ExtractionKind, json: ExtractionJson | null, multiPart: boolean): Checked {
  const raw: RawCourse[] = Array.isArray(json?.courses) ? (json.courses as RawCourse[]) : [];
  const expected = Number(kind === 'transcript' ? json?.courseRowCount : json?.classCellCount) || 0;
  const valid = raw.filter((c) => {
    if (!c || !String(c.name || '').trim()) return false;
    if (kind === 'transcript') return Number.isFinite(Number(c.credits)) && String(c.grade || '').trim() !== '';
    return DAYS.includes(String(c.day)) && Number.isInteger(Number(c.period)) && Number(c.period) >= 1 && Number(c.period) <= 7;
  });
  let courses = valid;
  if (multiPart) {
    const seen = new Set<string>();
    courses = valid.filter((c) => {
      const key = kind === 'transcript' ? [norm(c.name), c.credits, norm(c.grade), c.takenYear ?? '', norm(c.term)].join('|') : [norm(c.name), c.day, c.period].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return {
    courses,
    expected,
    dropped: raw.length - valid.length,
    unreadable: Array.isArray(json?.unreadable) ? json.unreadable.filter(Boolean).map(String) : []
  };
}

// 読み落としの疑い：行数より少ない・1件もない・形の崩れた行がある
function looksIncomplete(c: Checked): boolean {
  return c.courses.length === 0 || c.courses.length < c.expected || c.dropped > 0;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const creditsOr2 = (v: unknown) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : 2);

function toProfileUpdate(kind: ExtractionKind, json: ExtractionJson | null, courses: RawCourse[]): unknown {
  let update: Record<string, unknown>;
  if (kind === 'transcript') {
    update = {
      action: 'transcript',
      ...(num(json?.printedTotalCredits) !== null ? { totalEarnedCredits: num(json?.printedTotalCredits) } : {}),
      ...(num(json?.printedGpa) !== null ? { currentGpa: num(json?.printedGpa) } : {}),
      completedCourses: courses.map((c) => ({
        name: String(c.name).trim(),
        credits: Number(c.credits),
        grade: String(c.grade).trim(),
        ...(c.takenYear ? { takenYear: Number(c.takenYear) } : {}),
        ...(c.term ? { term: String(c.term).trim() } : {})
      }))
    };
  } else if (kind === 'current_timetable') {
    const enrolled = courses.map((c) => ({
      name: String(c.name).trim(),
      day: c.day,
      period: Number(c.period),
      room: c.room ? String(c.room).trim() : '',
      teacher: c.teacher ? String(c.teacher).trim() : '',
      credits: creditsOr2(c.credits)
    }));
    update = { action: 'enroll_current_timetable', semesterCredits: enrolled.reduce((s, c) => s + c.credits, 0), enrolledCourses: enrolled };
  } else {
    update = {
      action: 'add_completed_timetable',
      addCompletedCourses: courses.map((c) => ({
        name: String(c.name).trim(),
        credits: creditsOr2(c.credits),
        grade: '修得'
      }))
    };
  }
  // 既存の取り込みと同じ正規化（評価の表記・再履修の扱い）を通す
  return parseProfileUpdateFromText('```profile_update\n' + JSON.stringify(update) + '\n```', true);
}

/**
 * 成績表・時間割を読み取る。行数より少ない・形の崩れた行があるときは、思考を増やして1回だけ読み直し、
 * 多く読めた方を使う。それでも足りなければ warning を付ける。
 */
export async function extractDocument(params: { apiKey: string; models: string[]; parts: MediaPart[]; kind: ExtractionKind; timeoutMs: number }): Promise<ExtractionResult> {
  const started = Date.now();
  const deadline = started + params.timeoutMs;
  const multiPart = params.parts.length > 1;
  // 成績表は思考を最小にしても精度が落ちなかった。時間割は画質が悪いと科目名を読み違えたので low（2026-11-07 実測）
  const firstLevel = params.kind === 'transcript' ? 'minimal' : 'low';
  const base = { apiKey: params.apiKey, models: params.models, parts: params.parts, kind: params.kind, deadline };

  const first = await callWithFallback({ ...base, thinkingLevel: firstLevel });
  let best = { model: first.model, json: first.json, checked: check(params.kind, first.json, multiPart) };
  let attempts = 1;

  // 読み直す時間が残っていれば（1回目にかかった時間の1.5倍を目安）再試行する
  const elapsed = Date.now() - started;
  if (looksIncomplete(best.checked) && deadline - Date.now() > elapsed * 1.5 + 2000) {
    try {
      const second = await callWithFallback({ ...base, thinkingLevel: firstLevel === 'minimal' ? 'low' : 'medium' });
      attempts++;
      const checked = check(params.kind, second.json, multiPart);
      if (checked.courses.length > best.checked.courses.length || (checked.courses.length === best.checked.courses.length && !looksIncomplete(checked))) {
        best = { model: second.model, json: second.json, checked };
      }
    } catch {
      // 1回目の結果を使う
    }
  }

  const { courses, expected, dropped, unreadable } = best.checked;
  if (courses.length === 0) {
    throw new ExtractionError('no_courses', undefined, 'no_courses');
  }

  let warning: string | undefined;
  const label = params.kind === 'transcript' ? '科目' : 'コマ';
  if (courses.length < expected) {
    warning = `表には${expected}${label}ありそうですが、読み取れたのは${courses.length}${label}です。一部の文字が読み取れなかった可能性があります。不足分は手動で追加するか、明るい場所で撮り直してください。`;
  } else if (dropped > 0 || unreadable.length > 0) {
    warning = `一部の文字が読み取れなかった可能性があります${unreadable.length ? `（${unreadable.slice(0, 3).join('、')}）` : ''}。反映された内容を確認してください。`;
  }

  const profileUpdate = toProfileUpdate(params.kind, best.json, courses);
  const reply =
    params.kind === 'transcript'
      ? `成績表から${courses.length}科目を読み取りました。`
      : params.kind === 'current_timetable'
        ? `時間割から${courses.length}コマを読み取りました。`
        : `過去の時間割から${courses.length}科目を読み取りました。`;
  return { model: best.model, profileUpdate, reply: warning ? `${reply}${warning}` : reply, warning, stats: { rowCount: expected, extracted: courses.length, attempts, ms: Date.now() - started } };
}
