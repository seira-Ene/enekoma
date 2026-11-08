// ログイン情報（ID・メールアドレス・パスワードのハッシュ）の保存先。成績・時間割・チャットは保存しない
// Redisがあればそこへ、ローカル開発でRedisがなければメモリに置く。Vercel上でRedisがないときは使えない扱いにする
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { deploymentEnv, redisCommand, redisSettings } from '../_lib/redis';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export interface ServerAccount {
  loginId: string;
  name: string;
  department: string;
  grade: number;
  admissionYear: 'reiwa7_or_later' | 'reiwa6_or_earlier';
  // 確認済みのメールアドレス（パスワード再設定・ID確認に使う）
  email?: string;
  // 確認メールのリンクを開くまでのメールアドレス
  pendingEmail?: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  // フレンドに渡すコード（英大文字と数字8桁）。最初にフレンド画面を開いたときに作る
  friendCode?: string;
  // フレンドに「今の授業・空きコマ」を見せるか。未設定は見せる（true）
  shareScheduleStatus?: boolean;
}

export class StorageUnavailableError extends Error {}

// ---- 保存領域（Redis か メモリ） ----
interface MemoryEntry { value: string; expiresAt?: number }
const memory = new Map<string, MemoryEntry>();
const memorySets = new Map<string, Set<string>>();

function backend() {
  const settings = redisSettings();
  if (settings) return { kind: 'redis' as const, settings };
  // 本番やPreviewでメモリに置くと、インスタンスごとに別々になって消える
  if (process.env.VERCEL) throw new StorageUnavailableError('Redis is not configured');
  return { kind: 'memory' as const };
}

export function storageKind(): 'redis' | 'memory' | 'unavailable' {
  try {
    return backend().kind;
  } catch {
    return 'unavailable';
  }
}

const prefix = () => `enekoma:account:${deploymentEnv()}:`;

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export async function kvGet(key: string): Promise<string | null> {
  const b = backend();
  if (b.kind === 'memory') return memoryGet(prefix() + key);
  const result = await redisCommand(b.settings, ['GET', prefix() + key]);
  return typeof result === 'string' ? result : null;
}

// onlyIfAbsent のときは、すでにあれば保存せず false を返す
export async function kvSet(key: string, value: string, options: { ttlSeconds?: number; onlyIfAbsent?: boolean } = {}): Promise<boolean> {
  const b = backend();
  const full = prefix() + key;
  if (b.kind === 'memory') {
    if (options.onlyIfAbsent && memoryGet(full) !== null) return false;
    memory.set(full, { value, expiresAt: options.ttlSeconds ? Date.now() + options.ttlSeconds * 1000 : undefined });
    return true;
  }
  const command: (string | number)[] = ['SET', full, value];
  if (options.ttlSeconds) command.push('EX', options.ttlSeconds);
  if (options.onlyIfAbsent) command.push('NX');
  const result = await redisCommand(b.settings, command);
  return result === 'OK';
}

export async function kvDel(key: string) {
  const b = backend();
  if (b.kind === 'memory') {
    memory.delete(prefix() + key);
    return;
  }
  await redisCommand(b.settings, ['DEL', prefix() + key]);
}

async function kvGetDel(key: string): Promise<string | null> {
  const b = backend();
  const full = prefix() + key;
  if (b.kind === 'memory') {
    const value = memoryGet(full);
    memory.delete(full);
    return value;
  }
  const result = await redisCommand(b.settings, ['GETDEL', full]);
  return typeof result === 'string' ? result : null;
}

export async function setAdd(key: string, member: string) {
  const b = backend();
  if (b.kind === 'memory') {
    const set = memorySets.get(prefix() + key) || new Set<string>();
    set.add(member);
    memorySets.set(prefix() + key, set);
    return;
  }
  await redisCommand(b.settings, ['SADD', prefix() + key, member]);
}

export async function setRemove(key: string, member: string) {
  const b = backend();
  if (b.kind === 'memory') {
    memorySets.get(prefix() + key)?.delete(member);
    return;
  }
  await redisCommand(b.settings, ['SREM', prefix() + key, member]);
}

export async function setMembers(key: string): Promise<string[]> {
  const b = backend();
  if (b.kind === 'memory') return Array.from(memorySets.get(prefix() + key) || []);
  const result = await redisCommand(b.settings, ['SMEMBERS', prefix() + key]);
  return Array.isArray(result) ? result.map(String) : [];
}

/** 回数制限。window秒の間に limit 回を超えたら false */
export async function allowAttempt(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const b = backend();
  const full = `${prefix()}rate:${bucket}`;
  if (b.kind === 'memory') {
    const current = Number(memoryGet(full) || 0) + 1;
    const existing = memory.get(full);
    memory.set(full, { value: String(current), expiresAt: existing?.expiresAt ?? Date.now() + windowSeconds * 1000 });
    return current <= limit;
  }
  const count = Number(await redisCommand(b.settings, ['INCR', full]));
  if (count === 1) await redisCommand(b.settings, ['EXPIRE', full, windowSeconds]);
  return count <= limit;
}

// ---- 正規化 ----
export function normalizeLoginId(id: string): string {
  return String(id || '').normalize('NFKC').trim();
}
const idKey = (loginId: string) => `id:${normalizeLoginId(loginId).toLowerCase()}`;

export function normalizeEmail(email: string): string {
  return String(email || '').normalize('NFKC').trim().toLowerCase();
}
const emailKey = (email: string) => `email:${normalizeEmail(email)}`;

// ---- パスワード（scrypt） ----
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// 照合に失敗したときも同じくらい時間をかけ、IDが存在するかを応答時間から推測させない
const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

// ---- アカウント ----
export async function getAccount(loginId: string): Promise<ServerAccount | null> {
  const raw = await kvGet(idKey(loginId));
  return raw ? (JSON.parse(raw) as ServerAccount) : null;
}

async function saveAccount(account: ServerAccount) {
  await kvSet(idKey(account.loginId), JSON.stringify({ ...account, updatedAt: new Date().toISOString() }));
}

export async function createAccount(input: Omit<ServerAccount, 'passwordHash' | 'createdAt' | 'updatedAt' | 'email'> & { password: string }): Promise<ServerAccount | null> {
  const now = new Date().toISOString();
  const { password, ...rest } = input;
  const account: ServerAccount = { ...rest, loginId: normalizeLoginId(input.loginId), passwordHash: await hashPassword(password), createdAt: now, updatedAt: now };
  const created = await kvSet(idKey(account.loginId), JSON.stringify(account), { onlyIfAbsent: true });
  return created ? account : null;
}

export async function checkLogin(loginId: string, password: string): Promise<ServerAccount | null> {
  const account = await getAccount(loginId);
  const ok = await verifyPassword(password, account?.passwordHash || DUMMY_HASH);
  return account && ok ? account : null;
}

export async function updatePassword(loginId: string, newPassword: string) {
  const account = await getAccount(loginId);
  if (!account) return false;
  await saveAccount({ ...account, passwordHash: await hashPassword(newPassword) });
  return true;
}

export async function updateProfile(loginId: string, fields: Partial<Pick<ServerAccount, 'name' | 'department' | 'grade' | 'admissionYear' | 'pendingEmail'>>) {
  const account = await getAccount(loginId);
  if (!account) return null;
  const next = { ...account, ...fields };
  await saveAccount(next);
  return next;
}

/** 確認が済んだメールアドレスを登録する（前のアドレスの紐付けは外す） */
export async function confirmEmail(loginId: string, email: string) {
  const account = await getAccount(loginId);
  if (!account) return null;
  if (account.email && normalizeEmail(account.email) !== normalizeEmail(email)) {
    await setRemove(emailKey(account.email), account.loginId);
  }
  await setAdd(emailKey(email), account.loginId);
  const next: ServerAccount = { ...account, email: normalizeEmail(email), pendingEmail: undefined };
  await saveAccount(next);
  return next;
}

export async function accountsForEmail(email: string): Promise<ServerAccount[]> {
  const ids = await setMembers(emailKey(email));
  const accounts = await Promise.all(ids.map((id) => getAccount(id)));
  // 別のアドレスに変えたあとの古い紐付けは使わない
  return accounts.filter((a): a is ServerAccount => !!a && !!a.email && normalizeEmail(a.email) === normalizeEmail(email));
}

// ---- メールのリンクに使う使い捨てトークン（保存するのはハッシュだけ） ----
export type TokenKind = 'reset' | 'verify';
const tokenKey = (kind: TokenKind, token: string) => `token:${kind}:${createHash('sha256').update(token).digest('hex')}`;

export async function issueToken(kind: TokenKind, payload: { loginId: string; email?: string }, ttlSeconds: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await kvSet(tokenKey(kind, token), JSON.stringify(payload), { ttlSeconds });
  return token;
}

/** 1回だけ使える。期限切れ・使用済みなら null */
export async function consumeToken(kind: TokenKind, token: string): Promise<{ loginId: string; email?: string } | null> {
  if (!token || token.length > 200) return null;
  const raw = await kvGetDel(tokenKey(kind, token));
  return raw ? JSON.parse(raw) : null;
}

// ---- ログイン中の印（フレンド機能など、ログインのあとにサーバーを呼ぶ機能で使う。保存するのはハッシュだけ） ----
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const sessionKey = (token: string) => `session:${createHash('sha256').update(token).digest('hex')}`;

export async function createSession(loginId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await kvSet(sessionKey(token), normalizeLoginId(loginId), { ttlSeconds: SESSION_TTL_SECONDS });
  return token;
}

/** ログイン中の印からログインIDを返す。期限切れ・不正なら null */
export async function sessionLoginId(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  return kvGet(sessionKey(token));
}

export async function deleteSession(token: string) {
  if (token && token.length <= 200) await kvDel(sessionKey(token));
}

// ---- フレンドコード ----
// 読み間違えやすい 0/O・1/I は使わない
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_LENGTH = 8;
const friendCodeKey = (code: string) => `friendcode:${code}`;

export function normalizeFriendCode(code: string): string {
  return String(code || '').normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');
}

export const isFriendCodeFormat = (code: string) => new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`).test(code);

/** フレンドコードを返す。まだなければ、ほかと重ならないコードを作って保存する */
export async function ensureFriendCode(loginId: string): Promise<string | null> {
  const account = await getAccount(loginId);
  if (!account) return null;
  if (account.friendCode) return account.friendCode;
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = randomBytes(FRIEND_CODE_LENGTH);
    const code = Array.from(bytes, (b) => FRIEND_CODE_ALPHABET[b % FRIEND_CODE_ALPHABET.length]).join('');
    if (await kvSet(friendCodeKey(code), account.loginId, { onlyIfAbsent: true })) {
      await saveAccount({ ...account, friendCode: code });
      return code;
    }
  }
  throw new Error('Could not allocate a friend code');
}

export async function loginIdForFriendCode(code: string): Promise<string | null> {
  const normalized = normalizeFriendCode(code);
  return isFriendCodeFormat(normalized) ? kvGet(friendCodeKey(normalized)) : null;
}

export async function setShareScheduleStatus(loginId: string, share: boolean) {
  const account = await getAccount(loginId);
  if (!account) return null;
  const next = { ...account, shareScheduleStatus: share };
  await saveAccount(next);
  return next;
}

export const sharesSchedule = (account: ServerAccount) => account.shareScheduleStatus !== false;

// テスト用：メモリの内容を消す
export function resetMemoryStoreForTests() {
  memory.clear();
  memorySets.clear();
}
