// メールアドレスの確認（画面とサーバーで同じ判定を使う）
// 大学のアドレスの打ち間違い（g.nihon-u.ac.jo など）や、よくある打ち間違い（gmail.con など）は登録させない

export const UNIVERSITY_EMAIL_DOMAIN = 'g.nihon-u.ac.jp';
// 教職員などのアドレス
const ALLOWED_NIHON_U_DOMAINS = new Set([UNIVERSITY_EMAIL_DOMAIN, 'nihon-u.ac.jp']);

// よくある打ち間違い → 正しいドメイン
const DOMAIN_TYPOS: Record<string, string> = {
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.jp': 'gmail.com',
  'yahoo.co.jo': 'yahoo.co.jp',
  'yahoo.co.j': 'yahoo.co.jp',
  'icloud.con': 'icloud.com',
  'outlook.con': 'outlook.com',
  'docomo.ne.j': 'docomo.ne.jp'
};

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string };

export function checkEmailAddress(input: string): EmailCheck {
  const email = String(input || '').normalize('NFKC').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'メールアドレスの形式が正しくありません。' };
  }
  const domain = email.slice(email.lastIndexOf('@') + 1);

  // 大学のドメインに似ているのに一致しない（g.nihon-u.ac.jo、g.nihonu.ac.jp、g.nihon-u.co.jp など）
  if (/nihon-?u/.test(domain) && !ALLOWED_NIHON_U_DOMAINS.has(domain)) {
    return { ok: false, message: `大学のメールアドレスは「@${UNIVERSITY_EMAIL_DOMAIN}」です。ドメインに打ち間違いがないか確認してください。` };
  }
  const fixed = DOMAIN_TYPOS[domain];
  if (fixed) {
    return { ok: false, message: `「@${domain}」は「@${fixed}」の打ち間違いではありませんか？確認してください。` };
  }
  // 日本の .ac.jp / .co.jp / .ne.jp / .or.jp / .go.jp / .ed.jp の打ち間違い（.ac.jo や .co.j など）
  const jp = domain.match(/\.(ac|co|ne|or|go|ed)\.([a-z]+)$/);
  if (jp && jp[2] !== 'jp' && ['jo', 'j', 'pj', 'jpp', 'ip', 'kp', 'hp'].includes(jp[2])) {
    return { ok: false, message: `「.${jp[1]}.${jp[2]}」は「.${jp[1]}.jp」の打ち間違いではありませんか？確認してください。` };
  }
  return { ok: true, email };
}

export const isUniversityEmail = (email: string) => email.trim().toLowerCase().endsWith(`@${UNIVERSITY_EMAIL_DOMAIN}`);
