import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface MaintenanceConfig {
  isActive: boolean;
  startDateTime: string;
  endDateTime: string;
  startDisplay: string;
  endDisplay: string;
  targetServices: string;
  noticeMessage?: string;
  updatedAt?: string;
}

// デフォルトのメンテナンス設定
const DEFAULT_CONFIG: MaintenanceConfig = {
  isActive: false,
  startDateTime: '2026-10-27T01:00',
  endDateTime: '2026-10-27T06:00',
  startDisplay: '2026年10月27日(火) 01:00',
  endDisplay: '2026年10月27日(火) 06:00',
  targetServices: '全サービス（時間割検索、空き教室案内、AIアシスタント、履修カルテ）',
  noticeMessage: '現在、新機能の追加および学部要覧・時間割データの更新作業を行っております。'
};

// メモリキャッシュ
let memoryConfig: MaintenanceConfig = { ...DEFAULT_CONFIG };

// 一時ファイルパス（サーバー再起動・インスタンス間での簡易永続化用）
const TMP_FILE = path.join(process.cwd(), '.maintenance_state.json');

function loadConfig(): MaintenanceConfig {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const data = fs.readFileSync(TMP_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      memoryConfig = { ...DEFAULT_CONFIG, ...parsed };
      return memoryConfig;
    }
  } catch (e) {
    // ignore
  }
  return memoryConfig;
}

function saveConfig(cfg: MaintenanceConfig) {
  memoryConfig = { ...cfg, updatedAt: new Date().toISOString() };
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(memoryConfig, null, 2), 'utf-8');
  } catch (e) {
    // serverless 環境などで書き込めない場合はメモリ上で保持
  }
}

export async function GET() {
  const config = loadConfig();
  return NextResponse.json({
    status: 'ok',
    maintenance: config
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

    if (action === 'verify') {
      return NextResponse.json({
        status: 'ok',
        isAdmin: true,
        maintenance: loadConfig()
      });
    }

    if (action === 'update' && config) {
      const current = loadConfig();
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
      saveConfig(updated);

      return NextResponse.json({
        status: 'ok',
        isAdmin: true,
        maintenance: updated,
        message: 'メンテナンス設定を更新しました。'
      });
    }

    return NextResponse.json({ error: '無効なリクエストです。' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

