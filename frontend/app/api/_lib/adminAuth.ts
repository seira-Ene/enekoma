// 管理者用APIの認証。管理者コードを ADMIN_SECRET_KEY と照合し、だめなら返すべき応答を返す
import { NextResponse } from 'next/server';

export function rejectUnlessAdmin(adminCode: unknown): NextResponse | null {
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  // 未設定のときは全て拒否する（undefined 同士の一致で認証を通さないため）
  if (!adminSecret) return NextResponse.json({ error: '管理者認証が設定されていません。' }, { status: 503 });
  if (typeof adminCode !== 'string' || adminCode !== adminSecret) {
    return NextResponse.json({ error: '管理者コードが正しくありません。' }, { status: 401 });
  }
  return null;
}
