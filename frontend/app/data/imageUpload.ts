// AI解析に送るファイルの準備。形式を中身から判定し、写真は縮小してから送る
// Vercelの関数はリクエスト本文が約4.5MBを超えると 413 で弾くので、送る前に大きさを確かめる

// 画像はこの大きさを超えたら縮小する（スマホの写真はほぼすべて対象）
const COMPRESS_OVER_BYTES = 500_000;
// 長辺の上限と、縦長のスクリーンショットで文字が潰れないための短辺の下限
const MAX_LONG_SIDE = 2000;
const MIN_SHORT_SIDE = 1000;
// 送る data URL の上限（base64 なので元のファイルで約3MB）。プロフィールなどと合わせて 4.5MB に収める
export const MAX_UPLOAD_DATA_URL_CHARS = 4_000_000;
export const MAX_UPLOAD_FILE_MB = 3;

// ファイル選択で出す形式。image/* があると、iPhone は写真ライブラリ・カメラを出し、HEIC を JPEG に変換して渡す
export const UPLOAD_ACCEPT = 'image/*,.heic,.heif,application/pdf,.pdf,text/plain,.txt,text/csv,.csv,.tsv';

export type UploadKind = 'image' | 'pdf' | 'text';

export type UploadErrorCode = 'too_large' | 'unsupported' | 'read_failed' | 'empty';

export class UploadError extends Error {
  code: UploadErrorCode;
  constructor(code: UploadErrorCode) {
    super(UPLOAD_ERROR_MESSAGES[code]);
    this.code = code;
  }
}

const UPLOAD_ERROR_MESSAGES: Record<UploadErrorCode, string> = {
  too_large: `ファイルサイズが大きすぎます（上限 約${MAX_UPLOAD_FILE_MB}MB）。PDFはページを分けるか、画面のスクリーンショットで送ってください。`,
  unsupported: '対応していない形式です。写真（JPEG・PNG・HEIC）、PDF、テキスト（CSV・TXT）を選んでください。Excelの表は、コピーして「テキスト貼付」に貼り付けてください。',
  read_failed: 'ファイルを読み込めませんでした。もう一度選び直すか、写真で撮り直してください。',
  empty: 'ファイルが空です。別のファイルを選んでください。'
};

/** 解析を頼んだときの失敗を、利用者に伝わる言葉にする */
export function describeAnalysisFailure(failure: { status?: number; error?: unknown }): string {
  const { status, error } = failure;
  if (error instanceof UploadError) return error.message;
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return '解析に時間がかかりすぎたため中断しました。電波の良い場所で、もう一度お試しください。';
  }
  if (error instanceof TypeError) {
    return '通信できませんでした。インターネットにつながっているか確認して、もう一度お試しください。';
  }
  if (status === 413) return UPLOAD_ERROR_MESSAGES.too_large;
  if (status === 429) return 'AIが混み合っています。少し時間をおいてから、もう一度お試しください。';
  if (status === 504 || status === 408) return '解析に時間がかかりすぎました。画像を小さくするか、ページを分けて送ってください。';
  if (status && status >= 500) return '解析サーバーでエラーが起きました。少し時間をおいてから、もう一度お試しください。';
  return '解析サーバーとの通信に失敗しました。もう一度お試しください。';
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/**
 * ファイルの中身（先頭のバイト）と拡張子から形式を決める。
 * Android では file.type が空のことがあり、拡張子のないファイルもあるので、中身を優先する。
 */
export async function detectUploadType(file: File): Promise<{ kind: UploadKind; mimeType: string }> {
  if (file.size === 0) throw new UploadError('empty');
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    throw new UploadError('read_failed');
  }
  const brand = String.fromCharCode(...head.slice(8, 12));
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return { kind: 'pdf', mimeType: 'application/pdf' };
  if (startsWith(head, [0xff, 0xd8, 0xff])) return { kind: 'image', mimeType: 'image/jpeg' };
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', mimeType: 'image/png' };
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return { kind: 'image', mimeType: 'image/gif' };
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...head.slice(8, 12)) === 'WEBP') return { kind: 'image', mimeType: 'image/webp' };
  if (String.fromCharCode(...head.slice(4, 8)) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) {
    return { kind: 'image', mimeType: brand === 'mif1' || brand === 'msf1' ? 'image/heif' : 'image/heic' };
  }
  if (startsWith(head, [0x42, 0x4d])) return { kind: 'image', mimeType: 'image/bmp' };
  // ZIP（Excel・Word など）は解析できない
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0xd0, 0xcf, 0x11, 0xe0])) throw new UploadError('unsupported');

  const lower = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type.includes('csv') || lower.endsWith('.csv')) return { kind: 'text', mimeType: 'text/csv' };
  if (type.startsWith('text/') || /\.(txt|tsv)$/.test(lower)) return { kind: 'text', mimeType: 'text/plain' };
  // 拡張子がなくても、文字だけのファイルならテキストとして扱う
  const sample = new Uint8Array(await file.slice(0, 2048).arrayBuffer());
  const looksText = sample.length > 0 && sample.every((b) => b === 9 || b === 10 || b === 13 || b >= 32);
  if (looksText) return { kind: 'text', mimeType: 'text/plain' };
  throw new UploadError('unsupported');
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new UploadError('read_failed'));
    reader.readAsDataURL(file);
  });
}

// createImageBitmap が使えない・失敗するブラウザ（古いSafariなど）は <img> で読む
async function decodeImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // 下の <img> で試す
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function drawToJpeg(image: { source: CanvasImageSource; width: number; height: number }, maxLongSide: number, quality: number): string | null {
  const longSide = Math.max(image.width, image.height);
  const shortSide = Math.min(image.width, image.height);
  // 最初の段階だけ短辺の下限を守る（それでも大きすぎるときは文字の読みやすさより送れることを優先する）
  const keepShortSide = maxLongSide >= MAX_LONG_SIDE;
  const scale = Math.min(1, keepShortSide ? Math.max(maxLongSide / longSide, MIN_SHORT_SIDE / shortSide) : maxLongSide / longSide);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  // 透過部分がJPEGで黒くならないよう白で塗る
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', quality);
  // メモリの少ないスマホで、大きなキャンバスを早く解放する
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

// 段階的に小さくして、上限に収まった最初のものを使う
const COMPRESSION_STEPS: [number, number][] = [
  [MAX_LONG_SIDE, 0.85],
  [1600, 0.78],
  [1280, 0.7]
];

async function compressImage(file: Blob): Promise<string | null> {
  const image = await decodeImage(file);
  try {
    let last: string | null = null;
    for (const [side, quality] of COMPRESSION_STEPS) {
      last = drawToJpeg(image, side, quality);
      if (last && last.length <= MAX_UPLOAD_DATA_URL_CHARS) return last;
    }
    return last;
  } finally {
    image.release();
  }
}

/**
 * 送信用の data URL を作る。写真は長辺2000px程度のJPEGにし、上限を超えるファイルは UploadError('too_large') にする。
 * mimeType を省くと中身から判定する。
 */
export async function prepareFileForUpload(file: File, mimeType?: string): Promise<{ data: string; mimeType: string; kind: UploadKind }> {
  const detected = mimeType ? { kind: (mimeType.startsWith('image/') ? 'image' : mimeType === 'application/pdf' ? 'pdf' : 'text') as UploadKind, mimeType } : await detectUploadType(file);
  const isHeif = /image\/hei[cf]/.test(detected.mimeType);
  const isCompressible = detected.kind === 'image' && detected.mimeType !== 'image/gif';

  if (isCompressible && (file.size > COMPRESS_OVER_BYTES || isHeif)) {
    try {
      const compressed = await compressImage(file);
      // HEIC は対応していないブラウザ・AIがあるので、変換できたら必ずJPEGにする
      if (compressed && (isHeif || compressed.length < file.size * 1.37)) {
        if (compressed.length > MAX_UPLOAD_DATA_URL_CHARS) throw new UploadError('too_large');
        return { data: compressed, mimeType: 'image/jpeg', kind: 'image' };
      }
    } catch (error) {
      if (error instanceof UploadError) throw error;
      console.warn('Image compression skipped:', error);
    }
  }

  // base64 にすると約4/3倍になる。読み込む前に分かるものは先に断る
  if (Math.ceil(file.size / 3) * 4 > MAX_UPLOAD_DATA_URL_CHARS) throw new UploadError('too_large');
  const data = await readAsDataUrl(file).catch(() => {
    throw new UploadError('read_failed');
  });
  if (data.length > MAX_UPLOAD_DATA_URL_CHARS) throw new UploadError('too_large');
  // FileReader が付ける型ではなく、判定した型で送る
  return { data: data.replace(/^data:[^;,]*/, `data:${detected.mimeType}`), mimeType: detected.mimeType, kind: detected.kind };
}
