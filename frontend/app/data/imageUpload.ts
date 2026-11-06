// AI解析に送るファイルの準備。大きい写真だけを縮小して、送信を速くし、サーバーの容量制限も避ける

// これ以下の画像はそのまま送る（送信に時間がかからず、画質を落とす必要がない）
const COMPRESS_OVER_BYTES = 1_000_000;
const MAX_LONG_SIDE = 2400;
// 縦長のスクリーンショットで文字が潰れないよう、短辺はここまでしか小さくしない
const MIN_SHORT_SIDE = 1000;
const JPEG_QUALITY = 0.85;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: Blob): Promise<string | null> {
  // HEICなどブラウザが読めない形式は例外になるので、呼び出し元で元のファイルを送る
  const bitmap = await createImageBitmap(file);
  try {
    const longSide = Math.max(bitmap.width, bitmap.height);
    const shortSide = Math.min(bitmap.width, bitmap.height);
    const scale = Math.min(1, Math.max(MAX_LONG_SIDE / longSide, MIN_SHORT_SIDE / shortSide));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return null;
    // 透過部分がJPEGで黒くならないよう白で塗る
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

export async function prepareFileForUpload(file: File, mimeType: string): Promise<{ data: string; mimeType: string }> {
  const original = await readAsDataUrl(file);
  const isCompressible = mimeType.startsWith('image/') && mimeType !== 'image/gif';
  if (!isCompressible || file.size <= COMPRESS_OVER_BYTES) {
    return { data: original, mimeType };
  }
  try {
    const compressed = await compressImage(file);
    // 図や表の画像はJPEGにすると大きくなることがあるので、小さくなったときだけ使う
    if (compressed && compressed.length < original.length) {
      return { data: compressed, mimeType: 'image/jpeg' };
    }
  } catch (error) {
    console.warn('Image compression skipped:', error);
  }
  return { data: original, mimeType };
}
