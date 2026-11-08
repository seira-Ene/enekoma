// お問い合わせが届いたことを管理者にメールで知らせる
// 送信先は ADMIN_EMAIL、なければ送信用のGmailアドレス（GMAIL_USER）。どちらもなければ送らずに記録だけ残す
import { maskEmail, recordMailLog } from '../account/mailLog';
import { sendMail } from '../account/mailer';
import type { FeedbackCategory, FeedbackItem } from './feedbackStore';

export const NOTIFY_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  review: '⭐レビュー',
  question: '❓質問',
  bug: '🐛不具合報告',
  opinion: 'ご意見'
};

export function adminNotificationAddress(): string | null {
  const address = (process.env.ADMIN_EMAIL || process.env.GMAIL_USER || '').trim();
  return address || null;
}

function jst(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + '（日本時間）';
}

function siteUrl(): string | null {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

export function buildFeedbackNotification(item: FeedbackItem): { subject: string; text: string } {
  const label = NOTIFY_CATEGORY_LABELS[item.category];
  const lines = [
    '新しいお問い合わせが届きました。',
    '',
    `送信日時：${jst(item.createdAt)}`,
    `種別：${label}`
  ];
  if (item.category === 'review' && item.rating) lines.push(`評価：${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}（${item.rating}）`);
  if (item.email) lines.push(`返信用メールアドレス：${item.email}`);
  if (item.loginId) lines.push(`ログインID（送信者の申告）：${item.loginId}`);
  lines.push('', '――お問い合わせ本文――', item.message, '――――――――――――', '');
  const url = siteUrl();
  lines.push(url ? `管理者モードの「💬 お問い合わせ」で対応状況を更新できます：${url}` : '管理者モードの「💬 お問い合わせ」で対応状況を更新できます。');
  lines.push('', 'このメールはエネコマから自動で送信しています。');
  return { subject: `【エネコマ通知】新しいお問い合わせが届きました（${label}）`, text: lines.join('\n') };
}

/** 管理者に通知する。失敗しても例外は投げない（呼び出し元の保存や応答に影響させない） */
export async function notifyAdminOfFeedback(item: FeedbackItem): Promise<void> {
  try {
    const to = adminNotificationAddress();
    const { subject, text } = buildFeedbackNotification(item);
    if (!to) {
      await recordMailLog({ status: 'skipped', to: '（管理者アドレス未設定）', subject, reason: 'no_admin_email（ADMIN_EMAIL と GMAIL_USER が未設定）' });
      return;
    }
    // 結果（送信・失敗）は sendMail がメール送信ログに残す
    await sendMail({ to, subject, text });
  } catch (error) {
    console.error('Feedback notification failed:', error);
    try {
      await recordMailLog({ status: 'failed', to: maskEmail(adminNotificationAddress() || ''), subject: '【エネコマ通知】新しいお問い合わせ', response: String((error as Error)?.message || error) });
    } catch {
      // 記録もできないときは諦める
    }
  }
}
