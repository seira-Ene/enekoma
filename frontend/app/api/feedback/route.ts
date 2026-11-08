// お問い合わせ・フィードバックの受付（レビュー・ご意見・質問・不具合報告）
import { after, NextRequest, NextResponse } from 'next/server';
import { checkEmailAddress } from '@/app/data/emailAddress';
import { allowAttempt, StorageUnavailableError } from '../account/accountStore';
import { addFeedback, FEEDBACK_CATEGORIES, FeedbackCategory, FeedbackItem, FeedbackStorageUnavailableError } from './feedbackStore';
import { notifyAdminOfFeedback } from './notify';

// 管理者への通知メールは、応答を返したあとに送る（送信の遅れや失敗で、保存や完了表示を止めない）
function notifyAfterResponse(item: FeedbackItem) {
  try {
    after(() => notifyAdminOfFeedback(item));
  } catch {
    // リクエストの外（テストなど）で after が使えないときは、待たずに送る
    void notifyAdminOfFeedback(item);
  }
}

const MESSAGE_MIN = 5;
const MESSAGE_MAX = 2000;

const fail = (status: number, error: string, message: string) => NextResponse.json({ ok: false, error, message }, { status });

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'invalid_body', '不正なリクエストです。');
  }

  // 人には見えない入力欄に値が入っていたら、自動送信とみなして受け付けたふりをする
  if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ ok: true });

  const category = String(body.category || '') as FeedbackCategory;
  if (!FEEDBACK_CATEGORIES.includes(category)) return fail(400, 'invalid_category', '種類を選んでください。');
  const message = String(body.message || '').trim();
  if (message.length < MESSAGE_MIN) return fail(400, 'too_short', `内容を${MESSAGE_MIN}文字以上で入力してください。`);
  if (message.length > MESSAGE_MAX) return fail(400, 'too_long', `内容は${MESSAGE_MAX}文字以内にしてください。`);

  const rating = Number(body.rating);
  let email: string | undefined;
  if (typeof body.email === 'string' && body.email.trim()) {
    const check = checkEmailAddress(body.email);
    if (!check.ok) return fail(400, 'invalid_email', check.message);
    email = check.email;
  }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
    if (!(await allowAttempt(`feedback:${ip}`, 5, 3600))) {
      return fail(429, 'rate_limited', '送信の回数が多すぎます。しばらくしてからお試しください。');
    }
    const item = await addFeedback({
      category,
      message,
      ...(category === 'review' && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? { rating } : {}),
      ...(email ? { email } : {}),
      ...(typeof body.loginId === 'string' && body.loginId.trim() ? { loginId: body.loginId.trim().slice(0, 32) } : {}),
      ...(category === 'bug' ? { userAgent: (request.headers.get('user-agent') || '').slice(0, 200) } : {})
    });
    notifyAfterResponse(item);
    return NextResponse.json({ ok: true, id: item.id });
  } catch (error) {
    if (!(error instanceof FeedbackStorageUnavailableError || error instanceof StorageUnavailableError)) console.error('Feedback error:', error);
    return fail(503, 'storage_unavailable', '送信できませんでした。しばらくしてからお試しください。');
  }
}
