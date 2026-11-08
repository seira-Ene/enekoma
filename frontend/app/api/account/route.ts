// アカウントのログイン・登録と、メールでのパスワード再設定・ログインID確認
// 成績・時間割・チャットはサーバーに送らず、これまで通り端末に保存する
import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_DEMO_ACCOUNTS, PASSWORD_MIN_LENGTH } from '@/app/data/studentAccounts';
import {
  accountsForEmail,
  allowAttempt,
  checkLogin,
  confirmEmail,
  consumeToken,
  createAccount,
  getAccount,
  issueToken,
  normalizeEmail,
  normalizeLoginId,
  ServerAccount,
  StorageUnavailableError,
  storageKind,
  updatePassword,
  updateProfile
} from './accountStore';
import { isMailConfigured, sendMail } from './mailer';
import { maskEmail, maskIdentifier, recordMailLog } from './mailLog';

const RESET_TTL_SECONDS = 30 * 60;
const VERIFY_TTL_SECONDS = 24 * 60 * 60;

type Body = Record<string, unknown>;

const fail = (status: number, error: string, message: string) => NextResponse.json({ ok: false, error, message }, { status });
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function publicAccount(a: ServerAccount) {
  return {
    loginId: a.loginId,
    name: a.name,
    department: a.department,
    grade: a.grade,
    admissionYear: a.admissionYear,
    email: a.email || null,
    pendingEmail: a.pendingEmail || null
  };
}

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

// メールのリンク先。Hostヘッダーから作ると偽のドメインのリンクを送らせられるので、設定値を優先する
function appBaseUrl(request: NextRequest): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

const isValidLoginId = (id: string) => /^[A-Za-z0-9._-]{3,32}$/.test(id);
const isValidEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (pw: string) => pw.length >= PASSWORD_MIN_LENGTH && pw.length <= 128;
const isDemoId = (id: string) => Object.keys(INITIAL_DEMO_ACCOUNTS).includes(id);

const MAIL_SIGNATURE = '\n\n――\nエネコマ（日本大学文理学部 履修アシスタント）\nこのメールは送信専用です。';

const VERIFY_SUBJECT = '【エネコマ】メールアドレスの確認';

async function sendVerification(request: NextRequest, account: ServerAccount, email: string): Promise<boolean> {
  if (!(await allowAttempt(`mail:${normalizeEmail(email)}`, 3, 3600))) {
    await recordMailLog({ status: 'skipped', to: maskEmail(email), subject: VERIFY_SUBJECT, reason: 'rate_limited（同じアドレスへの送信は1時間に3通まで）' });
    return false;
  }
  const token = await issueToken('verify', { loginId: account.loginId, email: normalizeEmail(email) }, VERIFY_TTL_SECONDS);
  const url = `${appBaseUrl(request)}/?verify_email=${encodeURIComponent(token)}`;
  const result = await sendMail({
    to: email,
    subject: VERIFY_SUBJECT,
    text: `${account.name}さん（ログインID: ${account.loginId}）\n\nエネコマにこのメールアドレスが登録されました。下のリンクを開くと確認が完了し、パスワードやログインIDを忘れたときにこのアドレスで再設定・確認できるようになります。リンクの有効期限は24時間です。\n\n${url}\n\n心当たりがない場合は、このメールを破棄してください。${MAIL_SIGNATURE}`
  });
  return result.sent;
}

async function handle(request: NextRequest, body: Body) {
  const action = str(body.action, 40);
  const ip = clientIp(request);

  switch (action) {
    case 'register': {
      const loginId = normalizeLoginId(str(body.loginId, 64));
      const password = str(body.password, 200);
      const email = normalizeEmail(str(body.email, 300));
      if (!isValidLoginId(loginId)) return fail(400, 'invalid_login_id', 'ログインIDは半角英数字（3〜32文字）で入力してください。');
      if (isDemoId(loginId)) return fail(400, 'reserved', 'このIDはデモアカウント用のため使えません。');
      if (!isValidPassword(password)) return fail(400, 'weak_password', `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。`);
      if (email && !isValidEmail(email)) return fail(400, 'invalid_email', 'メールアドレスの形式が正しくありません。');
      if (!(await allowAttempt(`register:${ip}`, 10, 3600))) return fail(429, 'rate_limited', '登録の回数が多すぎます。しばらくしてからお試しください。');
      const grade = Math.min(6, Math.max(1, Number(body.grade) || 1));
      const account = await createAccount({
        loginId,
        password,
        name: str(body.name, 40).trim() || `学生(${loginId})`,
        department: str(body.department, 40) || '情報科学科',
        grade,
        admissionYear: body.admissionYear === 'reiwa6_or_earlier' ? 'reiwa6_or_earlier' : 'reiwa7_or_later',
        ...(email ? { pendingEmail: email } : {})
      });
      if (!account) return fail(409, 'id_taken', 'このログインIDはすでに登録されています。');
      const verificationSent = email ? await sendVerification(request, account, email) : false;
      return NextResponse.json({ ok: true, account: publicAccount(account), verificationSent, mailConfigured: isMailConfigured() });
    }

    case 'login': {
      const loginId = normalizeLoginId(str(body.loginId, 64));
      const password = str(body.password, 200);
      if (!loginId || !password) return fail(400, 'missing', 'ログインIDとパスワードを入力してください。');
      const allowed = (await allowAttempt(`login:${loginId.toLowerCase()}`, 10, 900)) && (await allowAttempt(`login-ip:${ip}`, 50, 900));
      if (!allowed) return fail(429, 'rate_limited', 'ログインの試行回数が多すぎます。15分ほど待ってからお試しください。');
      const account = await checkLogin(loginId, password);
      if (!account) return fail(401, 'invalid', 'ログインIDまたはパスワードが違います。');
      return NextResponse.json({ ok: true, account: publicAccount(account) });
    }

    case 'request_password_reset':
    case 'request_login_id': {
      const identifier = str(body.identifier, 300).trim();
      const subject = action === 'request_login_id' ? '【エネコマ】ログインIDのお知らせ' : '【エネコマ】パスワード再設定のご案内';
      const skip = (reason: string) => recordMailLog({ status: 'skipped', to: maskIdentifier(identifier), subject, reason });
      if (!isMailConfigured()) {
        await skip('not_configured（メール送信の環境変数が未設定）');
        return fail(503, 'mail_not_configured', 'メール送信の準備がまだできていません。管理者にお問い合わせください。');
      }
      if (!(await allowAttempt(`forgot-ip:${ip}`, 10, 3600))) {
        await skip('rate_limited（同じ接続元からの申し込みは1時間に10回まで）');
        return fail(429, 'rate_limited', '申し込みの回数が多すぎます。しばらくしてからお試しください。');
      }
      const accounts = identifier.includes('@')
        ? await accountsForEmail(identifier)
        : action === 'request_password_reset'
          ? [await getAccount(identifier)].filter((a): a is ServerAccount => !!a?.email)
          : [];
      const email = accounts[0]?.email;
      if (!email) {
        // 送らなかった理由を管理者が確認できるようにする（利用者への応答は変えない）
        if (identifier.includes('@')) await skip('no_verified_account（このアドレスで確認済みのアカウントがない）');
        else if (action === 'request_login_id') await skip('invalid_identifier（ID確認はメールアドレスで申し込む）');
        else {
          const account = await getAccount(identifier);
          await skip(!account
            ? 'account_not_found（このログインIDはサーバーに未登録）'
            : account.pendingEmail
              ? 'email_not_verified（確認メールのリンクがまだ開かれていない）'
              : 'no_email（メールアドレスが未登録）');
        }
      }
      // 同じアドレスへの送信は1時間に3回まで。超えても応答は変えない（アカウントの有無を推測させない）
      const allowed = email ? await allowAttempt(`mail:${email}`, 3, 3600) : false;
      if (email && !allowed) await skip('rate_limited（同じアドレスへの送信は1時間に3通まで）');
      if (email && allowed) {
        if (action === 'request_login_id') {
          const list = accounts.map((a) => `・${a.loginId}（${a.name}さん・${a.department}）`).join('\n');
          await sendMail({
            to: email,
            subject: '【エネコマ】ログインIDのお知らせ',
            text: `このメールアドレスに登録されているエネコマのログインIDは次のとおりです。\n\n${list}\n\nパスワードを忘れた場合は、ログイン画面の「パスワードを忘れた方」から再設定できます。心当たりがない場合は、このメールを破棄してください。${MAIL_SIGNATURE}`
          });
        } else {
          for (const account of accounts) {
            const token = await issueToken('reset', { loginId: account.loginId }, RESET_TTL_SECONDS);
            const url = `${appBaseUrl(request)}/?reset_password=${encodeURIComponent(token)}`;
            await sendMail({
              to: email,
              subject: '【エネコマ】パスワード再設定のご案内',
              text: `${account.name}さん（ログインID: ${account.loginId}）\n\nパスワード再設定の申し込みを受け付けました。下のリンクを開いて、新しいパスワードを設定してください。リンクの有効期限は30分で、1回だけ使えます。\n\n${url}\n\n心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。${MAIL_SIGNATURE}`
            });
          }
        }
      }
      return NextResponse.json({ ok: true, message: 'メールアドレスが確認済みのアカウントであれば、登録されたアドレスにメールを送りました。届かない場合は迷惑メールフォルダも確認してください。' });
    }

    case 'reset_password': {
      const password = str(body.newPassword, 200);
      if (!isValidPassword(password)) return fail(400, 'weak_password', `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。`);
      const payload = await consumeToken('reset', str(body.token, 200));
      if (!payload || !(await updatePassword(payload.loginId, password))) {
        return fail(400, 'invalid_token', 'リンクの有効期限が切れているか、すでに使われています。もう一度、再設定を申し込んでください。');
      }
      return NextResponse.json({ ok: true, loginId: payload.loginId });
    }

    case 'verify_email': {
      const payload = await consumeToken('verify', str(body.token, 200));
      const account = payload ? await getAccount(payload.loginId) : null;
      // 確認メールのあとに別のアドレスへ変えていたら、古いリンクでは登録しない
      if (!payload?.email || !account || normalizeEmail(account.pendingEmail || '') !== payload.email) {
        return fail(400, 'invalid_token', '確認リンクの有効期限が切れているか、すでに使われています。');
      }
      const updated = await confirmEmail(account.loginId, payload.email);
      return NextResponse.json({ ok: true, account: updated ? publicAccount(updated) : null });
    }

    case 'set_email':
    case 'change_password': {
      const loginId = normalizeLoginId(str(body.loginId, 64));
      if (!(await allowAttempt(`login:${loginId.toLowerCase()}`, 10, 900))) return fail(429, 'rate_limited', '試行回数が多すぎます。15分ほど待ってからお試しください。');
      const account = await checkLogin(loginId, str(body.password, 200));
      if (!account) return fail(401, 'invalid', '現在のパスワードが違います。');

      if (action === 'change_password') {
        const next = str(body.newPassword, 200);
        if (!isValidPassword(next)) return fail(400, 'weak_password', `新しいパスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。`);
        await updatePassword(account.loginId, next);
        return NextResponse.json({ ok: true });
      }

      const email = normalizeEmail(str(body.email, 300));
      if (!isValidEmail(email)) return fail(400, 'invalid_email', 'メールアドレスの形式が正しくありません。');
      if (!isMailConfigured()) {
        await recordMailLog({ status: 'skipped', to: maskEmail(email), subject: VERIFY_SUBJECT, reason: 'not_configured（メール送信の環境変数が未設定）' });
        return fail(503, 'mail_not_configured', 'メール送信の準備がまだできていないため、確認メールを送れません。');
      }
      const updated = await updateProfile(account.loginId, { pendingEmail: email });
      const verificationSent = updated ? await sendVerification(request, updated, email) : false;
      if (!verificationSent) return fail(429, 'mail_failed', '確認メールを送れませんでした。しばらくしてからお試しください。');
      return NextResponse.json({ ok: true, account: publicAccount(updated!), verificationSent });
    }

    default:
      return fail(400, 'unknown_action', '不正なリクエストです。');
  }
}

export async function GET() {
  return NextResponse.json({ mailConfigured: isMailConfigured(), storage: storageKind() });
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'invalid_body', '不正なリクエストです。');
  }
  try {
    return await handle(request, body);
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) console.error('Account API error:', error);
    return fail(503, 'storage_unavailable', 'アカウントのサーバーに接続できませんでした。しばらくしてからお試しください。');
  }
}
