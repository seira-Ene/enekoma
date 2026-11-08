// メール送信。送信サービスは環境変数で切り替える
//   Gmail（無料・独自ドメイン不要）: GMAIL_USER と GMAIL_APP_PASSWORD（Googleアカウントのアプリパスワード）
//   Resend                          : MAIL_PROVIDER=resend、RESEND_API_KEY、MAIL_FROM
//   未設定のローカル開発            : 送信せず、内容をサーバーのログに出す
// MAIL_PROVIDER を指定しなければ、設定のあるサービスを使う（両方あればGmail）
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { maskEmail, recordMailLog } from './mailLog';

export { maskEmail };

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

// ---- 送信結果の記録（1通につき1行。実行ログとRedisに残す。本文・リンク・パスワードは出さない） ----
async function logMailResult(entry: { provider: string; to: string; subject: string; ok: boolean; response?: unknown; detail?: unknown }) {
  await recordMailLog({
    status: entry.ok ? 'sent' : 'failed',
    provider: entry.provider,
    to: maskEmail(entry.to),
    subject: entry.subject,
    response: entry.response === undefined ? undefined : String(entry.response),
    detail: entry.detail === undefined ? undefined : String(entry.detail)
  });
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
    const info = await getGmailTransport().sendMail({ from: gmailFrom(), to: message.to, subject: message.subject, text: message.text });
    // response は Gmail の応答（例: 250 2.0.0 OK ... - gsmtp）。宛先を断られたら rejected に入る
    const rejected = (info.rejected || []).length;
    await logMailResult({
      provider: 'gmail',
      to: message.to,
      subject: message.subject,
      ok: rejected === 0,
      response: info.response,
      detail: `messageId=${info.messageId || ''}${rejected ? ` rejected=${rejected}` : ''}`
    });
    return rejected === 0 ? { sent: true } : { sent: false, reason: 'failed' };
  } catch (error) {
    const e = error as { code?: string; responseCode?: number; response?: string; message?: string };
    const isAuthError = e.code === 'EAUTH' || e.responseCode === 535;
    await logMailResult({
      provider: 'gmail',
      to: message.to,
      subject: message.subject,
      ok: false,
      response: e.response || e.message,
      // 認証エラーは設定の誤りなので分かるように残す（パスワードそのものはログに出さない）
      detail: isAuthError
        ? 'Gmail authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD (an app password, not the normal Google password).'
        : `code=${e.code || ''} responseCode=${e.responseCode || ''}`
    });
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
    const body = await response.text().catch(() => '');
    await logMailResult({ provider: 'resend', to: message.to, subject: message.subject, ok: response.ok, response: `${response.status} ${body}` });
    return response.ok ? { sent: true } : { sent: false, reason: 'failed' };
  } catch (error) {
    await logMailResult({ provider: 'resend', to: message.to, subject: message.subject, ok: false, response: (error as Error)?.message || error });
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
      await logMailResult({ provider: 'log', to: message.to, subject: message.subject, ok: true, response: 'ローカル開発のためログに出力' });
      return { sent: true };
    default:
      await recordMailLog({ status: 'skipped', to: maskEmail(message.to), subject: message.subject, reason: 'not_configured' });
      return { sent: false, reason: 'not_configured' };
  }
}
