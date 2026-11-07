// メール送信。送信サービスは環境変数で切り替える
//   Gmail（無料・独自ドメイン不要）: GMAIL_USER と GMAIL_APP_PASSWORD（Googleアカウントのアプリパスワード）
//   Resend                          : MAIL_PROVIDER=resend、RESEND_API_KEY、MAIL_FROM
//   未設定のローカル開発            : 送信せず、内容をサーバーのログに出す
// MAIL_PROVIDER を指定しなければ、設定のあるサービスを使う（両方あればGmail）
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailResult = { sent: true } | { sent: false; reason: 'not_configured' | 'failed' };

type Provider = 'gmail' | 'resend' | 'log' | 'none';

const gmailReady = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const resendReady = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

function provider(): Provider {
  const chosen = (process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  if (chosen === 'gmail') return gmailReady() ? 'gmail' : 'none';
  if (chosen === 'resend') return resendReady() ? 'resend' : 'none';
  if (!chosen && gmailReady()) return 'gmail';
  if (!chosen && process.env.RESEND_API_KEY) return resendReady() ? 'resend' : 'none';
  // Vercel上でログに出すと、再設定のリンクがログを見られる人に渡ってしまうので使わない
  return process.env.VERCEL ? 'none' : 'log';
}

export function isMailConfigured(): boolean {
  return provider() !== 'none';
}

// ---- Gmail（SMTP） ----
let gmailTransport: Transporter | null = null;
let gmailTransportKey = '';

function getGmailTransport(): Transporter {
  const user = process.env.GMAIL_USER!.trim();
  // アプリパスワードは「abcd efgh ijkl mnop」のように空白入りで表示されるので、空白を除く
  const pass = process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, '');
  const key = `${user}:${pass.length}`;
  if (!gmailTransport || gmailTransportKey !== key) {
    gmailTransport = createGmailTransport({ user, pass });
    gmailTransportKey = key;
  }
  return gmailTransport;
}

let createGmailTransport = (auth: { user: string; pass: string }): Transporter =>
  nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth,
    // 応答がないときにリクエスト全体が止まらないようにする
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });

/** テスト用：実際のGmailにつながない送信処理に差し替える */
export function replaceGmailTransportForTests(factory: (auth: { user: string; pass: string }) => Transporter) {
  createGmailTransport = factory;
  gmailTransport = null;
}

function gmailFrom(): string {
  // Gmailは送信元を認証したアカウントのアドレスに置き換えるので、表示名だけを変えられる
  return process.env.MAIL_FROM?.trim() || `"エネコマ" <${process.env.GMAIL_USER!.trim()}>`;
}

async function sendWithGmail(message: MailMessage): Promise<MailResult> {
  try {
    await getGmailTransport().sendMail({ from: gmailFrom(), to: message.to, subject: message.subject, text: message.text });
    return { sent: true };
  } catch (error) {
    const e = error as { code?: string; responseCode?: number; message?: string };
    // 認証エラーは設定の誤りなので分かるように残す（パスワードそのものはログに出さない）
    if (e.code === 'EAUTH' || e.responseCode === 535) {
      console.error('Gmail authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD (an app password, not the normal Google password).');
    } else {
      console.error('Gmail send failed:', e.code || '', e.responseCode || '', e.message || error);
    }
    gmailTransport = null;
    return { sent: false, reason: 'failed' };
  }
}

// ---- Resend ----
async function sendWithResend(message: MailMessage): Promise<MailResult> {
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

export async function sendMail(message: MailMessage): Promise<MailResult> {
  switch (provider()) {
    case 'gmail':
      return sendWithGmail(message);
    case 'resend':
      return sendWithResend(message);
    case 'log':
      console.info(`[mail:dev] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
      return { sent: true };
    default:
      return { sent: false, reason: 'not_configured' };
  }
}
