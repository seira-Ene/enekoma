// メール送信。送信サービスは環境変数で切り替える
//   MAIL_PROVIDER=resend : RESEND_API_KEY と MAIL_FROM（例: "エネコマ <noreply@example.com>"）が必要
//   未設定のローカル開発 : 送信せず、内容をサーバーのログに出す
// 別のサービス（Gmailなど）を使うときは、send の分岐を足す
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailResult = { sent: true } | { sent: false; reason: 'not_configured' | 'failed' };

type Provider = 'resend' | 'log' | 'none';

function provider(): Provider {
  const chosen = (process.env.MAIL_PROVIDER || '').toLowerCase();
  if (chosen === 'resend' || (!chosen && process.env.RESEND_API_KEY)) {
    return process.env.RESEND_API_KEY && process.env.MAIL_FROM ? 'resend' : 'none';
  }
  // Vercel上でログに出すと、再設定のリンクがログを見られる人に渡ってしまうので使わない
  return process.env.VERCEL ? 'none' : 'log';
}

export function isMailConfigured(): boolean {
  return provider() !== 'none';
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const p = provider();
  if (p === 'none') return { sent: false, reason: 'not_configured' };

  if (p === 'log') {
    console.info(`[mail:dev] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
    return { sent: true };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.error('Mail send failed:', response.status, await response.text().catch(() => ''));
      return { sent: false, reason: 'failed' };
    }
    return { sent: true };
  } catch (error) {
    console.error('Mail send failed:', error);
    return { sent: false, reason: 'failed' };
  }
}
