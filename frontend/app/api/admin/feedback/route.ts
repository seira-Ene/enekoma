// 管理者用：お問い合わせの一覧・ステータス更新・削除
import { NextRequest, NextResponse } from 'next/server';
import { rejectUnlessAdmin } from '../../_lib/adminAuth';
import { deleteFeedback, FEEDBACK_STATUSES, FeedbackStatus, FeedbackUpdate, listFeedback, updateFeedback } from '../../feedback/feedbackStore';

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
        const fields: FeedbackUpdate = {};
        if (status) fields.status = status;
        if (typeof body.adminNote === 'string') fields.adminNote = body.adminNote.slice(0, 1000);
        if (typeof body.isPublic === 'boolean') fields.isPublic = body.isPublic;
        if (typeof body.faqTitle === 'string') fields.faqTitle = body.faqTitle.trim().slice(0, 100);
        if (typeof body.answer === 'string') fields.answer = body.answer.trim().slice(0, 4000);
        if (typeof body.isFaq === 'boolean') fields.isFaq = body.isFaq;
        // 回答のないものはFAQとして公開しない
        if (fields.isFaq || (fields.answer === '' && fields.isFaq !== false)) {
          const current = (await listFeedback()).find((i) => i.id === id);
          const answer = fields.answer ?? current?.answer ?? '';
          if (fields.isFaq && !answer.trim()) return NextResponse.json({ error: '回答・解決手順を書いてからFAQとして公開してください。' }, { status: 400 });
          // 回答を消したらFAQからも外す
          if (!answer.trim() && current?.isFaq) fields.isFaq = false;
        }
        const item = await updateFeedback(id, fields);
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
