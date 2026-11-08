// サイトのURLと、検索・SNSに出す名前と説明（layout・robots・sitemap・ユーザーの声で共通）

export const SITE_NAME = 'エネコマ（EneKoma）';
export const SITE_TITLE = 'エネコマ｜日本大学文理学部の履修管理・GPA計算・空き教室検索';
export const SITE_DESCRIPTION =
  '日本大学文理学部の学生向け履修アシスタント「エネコマ」。学部要覧に沿った卒業要件・必修のチェック、成績表からのGPA計算と目標GPAの逆算、時間割から空き教室をすぐ検索。無料で使えます。';
export const SITE_KEYWORDS = ['エネコマ', 'EneKoma', '日本大学', '日大', '文理学部', '履修管理', '履修登録', 'GPA計算', '卒業要件', '空き教室', '時間割', '学部要覧'];

/** 本番のURL（APP_BASE_URL → Vercelの本番ドメイン → 既定値の順） */
export function siteUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'https://enekoma.vercel.app';
}
