// 話し方の指定（「織田信長みたいに話して」）に合わせた短い文の生成と、決まった答えの口調の書き換え
import { keepsFacts, styleInstruction } from '@/app/data/speakingStyle';

const STYLE_TIMEOUT_MS = 8000;

/** 短い文を1つ作る（速いモデルから順に試し、すべて失敗したら null） */
async function callGeminiText(apiKey: string, models: readonly string[], system: string, text: string): Promise<{ text: string; model: string } | null> {
  const deadline = Date.now() + STYLE_TIMEOUT_MS * 2;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(Math.min(STYLE_TIMEOUT_MS, remaining)),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'minimal' } }
        })
      });
      if (res.status === 400 || res.status === 403) return null;
      if (!res.ok) continue;
      const data = await res.json();
      const out = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: { text?: string }) => p.text || '')
        .join('')
        .trim();
      if (out) return { text: out, model };
    } catch {
      // 次のモデルを試す
    }
  }
  return null;
}

const BASE = 'あなたは日本大学文理学部の履修アシスタント「エネコマ」です。LINEのような自然な会話文で、記号・太字・見出しは使いません。';

/** 話し方を変えたときのあいさつ（1〜2文）。作れなければ null */
export function styleGreeting(apiKey: string, models: readonly string[], style: string): Promise<{ text: string; model: string } | null> {
  return callGeminiText(
    apiKey,
    models,
    BASE + styleInstruction(style),
    'これからこの話し方で答えることを、あいさつを兼ねて1〜2文で伝えてください。成績や時間割などの具体的な内容には触れないでください。最後に「普通の話し方に戻して」と言えば戻せることを、その口調のまま短く添えてください。'
  );
}

/**
 * 決まった答え（フレンドの空きコマなど）の口調だけを書き換える。
 * 数字と keep の言葉（名前・教室・科目名）が1つでも消えたら、元の文を返す
 */
export async function restyleReply(apiKey: string, models: readonly string[], style: string, reply: string, keep: string[] = []): Promise<string> {
  const out = await callGeminiText(
    apiKey,
    models,
    BASE + styleInstruction(style),
    `次の文の内容（人名・教室・曜日・時限・科目名・数字）を一つも変えず、足しも削りもせずに、話し方だけを書き換えてください。書き換えた文だけを出力してください。\n\n${reply}`
  );
  return out && keepsFacts(reply, out.text, keep) ? out.text : reply;
}
