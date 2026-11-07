// メンテナンス設定の保存先。Redisが設定されていれば再デプロイやインスタンスの違いに影響されない
import fs from 'fs';
import path from 'path';
import { deploymentEnv, redisCommand, redisSettings } from '../../_lib/redis';

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

export interface LoadedMaintenanceConfig {
  config: MaintenanceConfig;
  persistent: boolean; // Redisに保存されるか
  storageError: boolean; // Redisの読み込みに失敗し、前回の値を返しているか
}

const DEFAULT_CONFIG: MaintenanceConfig = {
  isActive: false,
  startDateTime: '2026-10-27T01:00',
  endDateTime: '2026-10-27T06:00',
  startDisplay: '2026年10月27日(火) 01:00',
  endDisplay: '2026年10月27日(火) 06:00',
  targetServices: '全サービス（時間割検索、空き教室案内、AIアシスタント、履修カルテ）',
  noticeMessage: '現在、新機能の追加および学部要覧・時間割データの更新作業を行っております。'
};

// Redisが使えないときの前回値、およびRedis未設定時の保存先
let memoryConfig: MaintenanceConfig = { ...DEFAULT_CONFIG };

// Redis未設定のローカル開発用
const TMP_FILE = path.join(process.cwd(), '.maintenance_state.json');

// Previewでの操作が本番に影響しないよう、環境ごとにキーを分ける
function redisKey(): string {
  return `enekoma:maintenance:${deploymentEnv()}`;
}

export async function loadMaintenanceConfig(): Promise<LoadedMaintenanceConfig> {
  const settings = redisSettings();

  if (settings) {
    try {
      const stored = await redisCommand(settings, ['GET', redisKey()]);
      memoryConfig = typeof stored === 'string' ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
      return { config: memoryConfig, persistent: true, storageError: false };
    } catch (error) {
      console.error('Failed to load maintenance config:', error);
      return { config: memoryConfig, persistent: true, storageError: true };
    }
  }

  try {
    if (fs.existsSync(TMP_FILE)) {
      memoryConfig = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8')) };
    }
  } catch {
    // 読めないときはメモリ上の値を使う
  }
  return { config: memoryConfig, persistent: false, storageError: false };
}

// Redisへの保存に失敗したら例外を投げる。保存できていないのに更新済みとして扱わない
export async function saveMaintenanceConfig(config: MaintenanceConfig): Promise<MaintenanceConfig> {
  const next = { ...config, updatedAt: new Date().toISOString() };
  const settings = redisSettings();

  if (settings) {
    await redisCommand(settings, ['SET', redisKey(), JSON.stringify(next)]);
    memoryConfig = next;
    return next;
  }

  memoryConfig = next;
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // サーバーレス環境ではファイルに書けないのでメモリ上だけで保持する
  }
  return next;
}
