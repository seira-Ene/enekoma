// 管理者用：お問い合わせの一覧・ステータス更新・削除
import { NextRequest, NextResponse } from 'next/server';
import { rejectUnlessAdmin } from '../../_lib/adminAuth';
import { deleteFeedback, FEEDBACK_STATUSES, FeedbackStatus, listFeedback, updateFeedback } from '../../feedback/feedbackStore';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 });
  }
  const rejected = rejectUnlessAdmin(body.adminCode);
  if (rejected) return rejected;

  try {
    const id = typeof body.id === 'string' ? body.id : '';
    switch (body.action) {
      case 'list':
        return NextResponse.json({ status: 'ok', items: await listFeedback() });
      case 'update': {
        const status = body.status as FeedbackStatus | undefined;
        if (status !== undefined && !FEEDBACK_STATUSES.includes(status)) {
          return NextResponse.json({ error: 'ステータスが正しくありません。' }, { status: 400 });
        }
        const note = typeof body.adminNote === 'string' ? body.adminNote.slice(0, 1000) : undefined;
        const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : undefined;
        const item = await updateFeedback(id, {
          ...(status ? { status } : {}),
          ...(note !== undefined ? { adminNote: note } : {}),
          ...(isPublic !== undefined ? { isPublic } : {})
        });
        if (!item) return NextResponse.json({ error: '見つかりませんでした。' }, { status: 404 });
        return NextResponse.json({ status: 'ok', item });
      }
      case 'delete':
        if (!(await deleteFeedback(id))) return NextResponse.json({ error: '見つかりませんでした。' }, { status: 404 });
        return NextResponse.json({ status: 'ok' });
      default:
        return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin feedback error:', error);
    return NextResponse.json({ error: '保存先に接続できませんでした。' }, { status: 503 });
  }
}
