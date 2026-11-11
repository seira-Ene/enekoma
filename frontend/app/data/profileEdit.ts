// プロフィールの編集（名前・学科・学年・入学年度）。画面とサーバーの両方で同じ確認をする
export const DISPLAY_NAME_MAX = 40;

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

// 改行・タブなどの制御文字と、幅のない文字・書字方向の制御文字
const isInvisible = (c: number) =>
  c <= 0x1f || c === 0x7f || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x2064) || c === 0xfeff;

/** 名前（氏名・ニックネーム）を整える。前後と連続する空白をまとめ、制御文字を除く */
export function normalizeDisplayName(raw: string): NameCheck {
  const name = Array.from(String(raw ?? '').normalize('NFC'))
    // 改行・タブなどの制御文字と、幅のない文字は除く
    .filter((ch) => !isInvisible(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/[\s　]+/g, ' ')
    .trim();
  if (!name) return { ok: false, message: 'お名前またはニックネームを入力してください。' };
  if (Array.from(name).length > DISPLAY_NAME_MAX) return { ok: false, message: `お名前は${DISPLAY_NAME_MAX}文字以内にしてください。` };
  return { ok: true, name };
}

export interface AccountProfileFields {
  department: string;
  grade: number;
  admissionYear: 'reiwa7_or_later' | 'reiwa6_or_earlier';
}

/** カルテで変えた学科・学年・入学年度が、アカウントに保存した値と違うか（違えばアカウントとサーバーに反映する） */
export function changedAccountFields(
  account: AccountProfileFields,
  profile: { department?: string; grade?: number; admissionYear?: string }
): Partial<AccountProfileFields> | null {
  const changed: Partial<AccountProfileFields> = {};
  if (profile.department && profile.department !== account.department) changed.department = profile.department;
  if (typeof profile.grade === 'number' && profile.grade !== account.grade) changed.grade = profile.grade;
  const year = profile.admissionYear === 'reiwa6_or_earlier' ? 'reiwa6_or_earlier' : 'reiwa7_or_later';
  if (profile.admissionYear && year !== account.admissionYear) changed.admissionYear = year;
  return Object.keys(changed).length > 0 ? changed : null;
}

export const isValidGrade = (g: unknown): g is number => typeof g === 'number' && Number.isInteger(g) && g >= 1 && g <= 6;
export const isAdmissionYear = (y: unknown): y is AccountProfileFields['admissionYear'] => y === 'reiwa7_or_later' || y === 'reiwa6_or_earlier';
