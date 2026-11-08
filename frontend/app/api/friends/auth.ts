// ログイン時に受け取った印（Authorization: Bearer、またはチャットでは本文の sessionToken）からログインIDを返す
import { sessionLoginId } from '../account/accountStore';

export async function authenticate(request: { headers: { get(name: string): string | null } }, body?: { sessionToken?: unknown }): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : typeof body?.sessionToken === 'string' ? body.sessionToken : '';
  return token ? sessionLoginId(token) : null;
}
