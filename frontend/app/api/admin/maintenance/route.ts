import { NextRequest, NextResponse } from 'next/server';
import { loadMaintenanceConfig, MaintenanceConfig, saveMaintenanceConfig } from './maintenanceStore';

// 保存された最新の設定を毎回返す
export const dynamic = 'force-dynamic';

export async function GET() {
  const { config, persistent, storageError } = await loadMaintenanceConfig();
  return NextResponse.json({
    status: 'ok',
    maintenance: config,
    persistent,
    storageError
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminCode, action, config } = body;

    // 環境変数が未設定の場合は全リクエストを拒否する（undefined 同士の一致で認証を通さないため）
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret) {
      return NextResponse.json({ error: '管理者認証が設定されていません。' }, { status: 503 });
    }

    // 管理者コード検証
    if (adminCode !== adminSecret) {
      return NextResponse.json({ error: '管理者コードが正しくありません。' }, { status: 401 });
    }

    const loaded = await loadMaintenanceConfig();

    if (action === 'verify') {
      return NextResponse.json({
        status: 'ok',
        isAdmin: true,
        maintenance: loaded.config,
        persistent: loaded.persistent,
        storageError: loaded.storageError
      });
    }

    if (action === 'update' && config) {
      // 読み込みに失敗した状態で上書きすると、古い値で設定を壊してしまう
      if (loaded.storageError) {
        return NextResponse.json({ error: '保存先に接続できないため、設定を更新できませんでした。時間をおいて再度お試しください。' }, { status: 503 });
      }

      const current = loaded.config;
      const updated: MaintenanceConfig = {
        ...current,
        isActive: Boolean(config.isActive),
        startDateTime: config.startDateTime || current.startDateTime,
        endDateTime: config.endDateTime || current.endDateTime,
        startDisplay: config.startDisplay || current.startDisplay,
        endDisplay: config.endDisplay || current.endDisplay,
        targetServices: config.targetServices || current.targetServices,
        noticeMessage: config.noticeMessage ?? current.noticeMessage
      };

      let saved: MaintenanceConfig;
      try {
        saved = await saveMaintenanceConfig(updated);
      } catch (error) {
        console.error('Failed to save maintenance config:', error);
        return NextResponse.json({ error: '設定を保存できませんでした。時間をおいて再度お試しください。' }, { status: 503 });
      }

      return NextResponse.json({
        status: 'ok',
        isAdmin: true,
        maintenance: saved,
        persistent: loaded.persistent,
        storageError: false,
        message: 'メンテナンス設定を更新しました。'
      });
    }

    return NextResponse.json({ error: '無効なリクエストです。' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
