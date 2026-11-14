// 画面上部のメニュー（アイコンと項目名をセットで出す）。スマホとPCで同じ項目・同じ名前にする
import { GAKUBU_YORAN_DEPARTMENTS } from './gakubuYoran';

export type QuickMenuId = 'credits' | 'profile' | 'yoran' | 'voices' | 'feedback' | 'admin';

export interface QuickMenuItem {
  id: QuickMenuId;
  icon: string;
  label: string;
  // ボタンの説明（読み上げ・ツールチップ）
  description: string;
}

/** 卒業に必要な単位数（学科の要覧の値。学科が未登録・不明なら124） */
export const DEFAULT_GRADUATION_CREDITS = 124;
export function graduationCreditsFor(department: string | undefined | null): number {
  const total = department ? GAKUBU_YORAN_DEPARTMENTS[department]?.total : undefined;
  return typeof total === 'number' && total > 0 ? total : DEFAULT_GRADUATION_CREDITS;
}

/** 修得単位の表示用の値（未登録・壊れた値は0） */
export function displayCredits(credits: unknown): number {
  const n = Number(credits);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function creditsMenuLabel(credits: unknown, required: number): string {
  return `取得済み単位数（${displayCredits(credits)}/${required}）`;
}

export function quickMenuItems(credits: unknown, department: string | undefined | null): QuickMenuItem[] {
  const required = graduationCreditsFor(department);
  return [
    { id: 'credits', icon: '🎓', label: creditsMenuLabel(credits, required), description: '修得済み単位と卒業要件を確認' },
    { id: 'profile', icon: '👤', label: '学生履修プロフィール', description: '学生履修プロフィールの編集' },
    { id: 'yoran', icon: '📋', label: '『学部要覧』早見表', description: '学部要覧の早見表を開く' },
    { id: 'voices', icon: '❓', label: 'よくある質問・声', description: 'よくある質問・ユーザーの声' },
    { id: 'feedback', icon: '💬', label: 'お問い合わせ・フィードバック', description: 'お問い合わせ・フィードバック' },
    { id: 'admin', icon: '⚙️', label: 'システムメンテナンス管理設定', description: '管理者コントロールパネル' }
  ];
}
