// FAQ（よくある質問・不具合対処法）の検索。管理者が回答を書いて「FAQとして公開」にしたものだけを返す
//   ?q=語句                 : 語句をすべて含むもの
//   ?q=文&mode=similar      : 入力中の文と似たもの（フォームのサジェスト用）
//   ?category=bug&resolved=1: 種別と「解決済み」で絞り込む
import { NextRequest, NextResponse } from 'next/server';
import { FaqCategory, findSimilarFaq, searchFaqByKeyword } from '@/app/data/faqSearch';
import { FeedbackStorageUnavailableError, listPublicFaq } from '../feedback/feedbackStore';

const CATEGORIES = ['bug', 'question', 'opinion', 'review'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get('q') || '').slice(0, 500);
  const category: FaqCategory | 'all' = CATEGORIES.includes(params.get('category') || '') ? (params.get('category') as FaqCategory) : 'all';
  const resolvedOnly = params.get('resolved') === '1';
  const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 50));

  try {
    const all = await listPublicFaq();
    const filter = { category, resolvedOnly };
    const items = params.get('mode') === 'similar' ? findSimilarFaq(all, q, limit, filter) : searchFaqByKeyword(all, q, filter).slice(0, limit);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (!(error instanceof FeedbackStorageUnavailableError)) console.error('FAQ search error:', error);
    return NextResponse.json({ ok: false, items: [] }, { status: 503 });
  }
}
