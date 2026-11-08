// 管理者用：メール送信の記録（直近50件・7日間）を返す。管理者コードは ADMIN_SECRET_KEY と照合する
import { NextRequest, NextResponse } from 'next/server';
import { readMailLog } from '../../account/mailLog';
import { rejectUnlessAdmin } from '../../_lib/adminAuth';

export async function POST(req: NextRequest) {
  let adminCode: unknown;
  try {
    ({ adminCode } = await req.json());
  } catch {
    return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 });
  }

  const rejected = rejectUnlessAdmin(adminCode);
  if (rejected) return rejected;

  try {
    const entries = await readMailLog();
    return NextResponse.json({ status: 'ok', entries });
  } catch (error) {
    console.error('Failed to read mail log:', error);
    return NextResponse.json({ error: 'メール送信の記録を読み込めませんでした。' }, { status: 503 });
  }
}
