// キャンパスの施設（計算機室・PCを使える場所）の案内データ。
// Geminiには質問に合うものを参照データとして渡し（buildFacilityContext）、APIキーがないときは answerFacilityLocally で答える。
// ここにない教室・施設は推測で案内しない（以前、AIが「3号館に計算機室が並んでいる」と誤って答えた）
export interface CampusFacility {
  id: string;
  name: string;
  location: string;
  rooms?: string[];
  detail: string;
  // 質問に含まれていたらこの施設の情報を渡す語（NFKC・小文字・空白なしで比べる）
  keywords: string[];
}

export const CAMPUS_FACILITIES: CampusFacility[] = [
  {
    id: 'cs-computer-room',
    name: '情報科学科 学科計算機室',
    location: '8号館2階',
    rooms: ['8B203', '8B210'],
    detail: '情報科学科の実習・実験・演習で使う計算機室です。',
    keywords: ['計算機室', '学科計算機', '計算機', 'pc室', 'pcルーム', 'pc教室', 'パソコン室', 'パソコン教室', 'コンピュータ室', 'コンピューター室', '8b203', '8b210']
  },
  {
    id: 'library-pc',
    name: 'PCを使える場所（全学部の学生向け）',
    location: '図書館',
    detail: '図書館のPCコーナーや、ラーニング・コモンズなどでPCを使えます。',
    keywords: ['pc', 'パソコン', 'コンピュータ', 'コンピューター', '計算機', 'pcコーナー', 'パソコンコーナー']
  }
];

// 間違えやすい点（参照データに添えて、AIが創作しないようにする）
export const FACILITY_GUARD_NOTE =
  '計算機室・PCを使える場所として案内するのは、上の8号館2階（8B203・8B210）と図書館だけです。ほかの号館や教室番号（3号館の3204・3305など）を計算機室として挙げないでください。聞かれていない号館に「〇号館にはありません」と触れる必要もありません。';

const compact = (q: string) => q.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

/** 質問に合う施設（計算機室を聞かれたら、PCを使える場所も一緒に出す） */
export function findFacilities(query: string): CampusFacility[] {
  const text = compact(query);
  const hits = CAMPUS_FACILITIES.filter((f) => f.keywords.some((k) => text.includes(k)));
  if (hits.some((f) => f.id === 'cs-computer-room') && !hits.some((f) => f.id === 'library-pc')) {
    hits.push(CAMPUS_FACILITIES.find((f) => f.id === 'library-pc')!);
  }
  return hits;
}

const describe = (f: CampusFacility) => `・${f.name}：${f.location}${f.rooms ? `（${f.rooms.join('・')}）` : ''}。${f.detail}`;

/** Geminiに渡す参照データ。合う施設がなければ空文字 */
export function buildFacilityContext(query: string): string {
  const hits = findFacilities(query);
  if (hits.length === 0) return '';
  return [
    '【キャンパス施設の参照データ（登録済みの正確な情報）】',
    ...hits.map(describe),
    FACILITY_GUARD_NOTE,
    '施設の場所はこの参照データだけを使って答え、ここにない教室番号や施設を推測で補ったり作ったりしないでください。',
    '',
    ''
  ].join('\n');
}

// 場所・使える所を聞いている（「計算機室はどこ？」「パソコンが使える場所は？」）。空き教室・授業の質問は時間割の検索に任せる
const ASKS_PLACE = /どこ|場所|何号館|何階|使え|使いたい|ある[?？]?$|ありますか|行き方|案内/;
const TIMETABLE_TOPIC = /空き|空い|授業|講義|時間割|何限|曜日|開講/;
// 「PC」だけの質問でも、Wi-Fi・アカウント・印刷などの相談はコンピュータセンターの案内に任せる
const OTHER_PC_TOPIC = /wi-?fi|アカウント|パスワード|設定|つなが|接続|印刷|プリンタ|ログイン/;

/** APIキーがないときの答え。施設の場所の質問でなければ null */
export function answerFacilityLocally(query: string): string | null {
  const text = compact(query);
  if (TIMETABLE_TOPIC.test(text)) return null;
  const hits = findFacilities(query);
  if (hits.length === 0) return null;
  const roomAsked = /計算機|pc室|pcルーム|pc教室|パソコン室|パソコン教室|コンピュータ室|コンピューター室|8b203|8b210/.test(text);
  if (!roomAsked && (!ASKS_PLACE.test(text) || OTHER_PC_TOPIC.test(text))) return null;
  const lab = hits.find((f) => f.id === 'cs-computer-room');
  const pc = hits.find((f) => f.id === 'library-pc');
  if (lab) {
    return `情報科学科の学科計算機室は、8号館2階の8B203と8B210です。情報科学科の実習・実験・演習で使います。${pc ? 'ほかの学科の人も含めて、自由にPCを使いたいときは図書館（PCコーナーやラーニング・コモンズなど）が使えますよ。' : ''}`;
  }
  return 'PCを使いたいときは、図書館（PCコーナーやラーニング・コモンズなど）が使えますよ。情報科学科の実習で使う計算機室は、8号館2階の8B203と8B210です。';
}
