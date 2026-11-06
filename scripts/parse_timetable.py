#!/usr/bin/env python3
"""令和8年度の時間割PDFを frontend/app/data/ の JSON に変換する。

新カリ用は timetableReiwa8.json、旧カリ用は timetableReiwa8Legacy.json に出力する。

使い方:
  pip install pdfplumber
  python scripts/parse_timetable.py <PDFフォルダ> [--check]

同じ種類のPDFが複数あるときは、ファイル名の日付(_261105 など)が最も新しいものを使う。
--check を付けるとファイルを書き出さず、件数と要確認行だけを表示する。
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

DATA_DIR = Path(__file__).resolve().parent.parent / 'frontend' / 'app' / 'data'
CURRICULA = [
    ('新カリ', DATA_DIR / 'timetableReiwa8.json', '令和8年度授業時間割表(令和7年度以降入学者向け)'),
    ('旧カリ', DATA_DIR / 'timetableReiwa8Legacy.json', '令和8年度授業時間割表(令和6年度以前入学者向け)'),
]

# (ファイル名の先頭, 出力する区分)
SOURCES = [
    ('010-0', '全学共通教育基礎'), ('020', '総合教育'), ('031-0', '外国語(英語)'),
    ('032', '外国語(中国語)'), ('033', '外国語(ドイツ語)'), ('034', '外国語(その他)'),
    ('040', '基礎教育'), ('A-0', '哲学科'), ('B-0', '史学科'), ('C-0', '国文学科'),
    ('D-0', '中国語中国文化学科'), ('E-0', '英文学科'), ('F-0', 'ドイツ文学科'),
    ('G-0', '社会学科'), ('H-0', '社会福祉学科'), ('J-0', '教育学科'), ('K-0', '体育学科'),
    ('L-0', '心理学科'), ('M-0', '地理学科'), ('N-0', '地球科学科'), ('P-0', '数学科'),
    ('Q-0', '情報科学科'), ('R-0', '物理学科'), ('S-0', '生命科学科'), ('T-0', '化学科'),
    ('U-0', 'コース(教職)'), ('V-0', 'コース(学芸員等)'),
]

DEPT_ALIASES = {
    '哲': '哲学科', '哲学': '哲学科', '史': '史学科', '史学': '史学科', '国文': '国文学科',
    '中文': '中国語中国文化学科', '中国語中国文化': '中国語中国文化学科', '英文': '英文学科',
    'ドイツ文': 'ドイツ文学科', '社会': '社会学科', '社会福祉': '社会福祉学科', '教育': '教育学科',
    '体育': '体育学科', '心理': '心理学科', '地理': '地理学科', '地球科': '地球科学科',
    '地球科学': '地球科学科', '数': '数学科', '数学': '数学科', '情報科': '情報科学科',
    '情報': '情報科学科', '物理': '物理学科', '生命科': '生命科学科', '生命科学': '生命科学科',
    '化': '化学科', '化学': '化学科',
}
DAYS = '月火水木金土'
warnings = []


def clean(text):
    text = unicodedata.normalize('NFKC', text or '')
    # NFKC で統一されない部首互換文字(集中授業一覧のPDFで使われている)
    text = text.translate(str.maketrans({
        '⺟': '母', '⺠': '民', '⻁': '虎', '⻄': '西', '⻆': '角', '⻑': '長', '⻘': '青', '⻝': '食', '⻤': '鬼', '⻯': '竜', '⻲': '亀', '⻫': '斉',
        '⻭': '歯', '⻩': '黄', '⻫': '斉', '⺣': '火', '⻂': '衣', '⻖': '阜',
    }))
    text = text.replace('~', '〜').replace('〜〜', '〜')
    return re.sub(r'\s+', ' ', text).strip()


def date_key(path):
    match = re.search(r'_(\d{6})(?!\d)', path.name)
    return (match.group(1) if match else '000000', path.stat().st_mtime)


def latest(folder, prefix, marker):
    files = [p for p in folder.glob('*.pdf') if p.name.startswith(prefix) and marker in p.name]
    return max(files, key=date_key) if files else None


def latest_named(folder, needle):
    files = [p for p in folder.glob('*.pdf') if needle in p.name]
    return max(files, key=date_key) if files else None


def smallest_cell(cells, x, y):
    hits = [c for c in cells if c[0] - 0.5 <= x <= c[2] + 0.5 and c[1] - 0.5 <= y <= c[3] + 0.5]
    return min(hits, key=lambda c: (c[2] - c[0]) * (c[3] - c[1])) if hits else None


def center(word):
    return (word['x0'] + word['x1']) / 2, (word['top'] + word['bottom']) / 2


def cluster_rows(words):
    rows = []
    for word in sorted(words, key=lambda w: center(w)[1]):
        y = center(word)[1]
        tolerance = max(2.0, (word['bottom'] - word['top']) * 0.55)
        if rows and abs(rows[-1]['y'] - y) <= tolerance:
            rows[-1]['words'].append(word)
        else:
            rows.append({'y': y, 'words': [word]})
    return rows


def parse_targets(name):
    """授業名の括弧からクラス指定の学科と組を取り出す。"""
    targets, group = [], ''
    for inner in re.findall(r'\(([^()]*)\)', name):
        if re.search(r'\d+組', inner):
            group = inner
            continue
        parts = re.split(r'[・、,]', inner)
        mapped = [DEPT_ALIASES[p] for p in parts if p in DEPT_ALIASES]
        if mapped and all(p in DEPT_ALIASES or re.search(r'\d年生', p) for p in parts):
            targets += mapped
    return sorted(set(targets)), group


def parse_grid(path, source):
    entries = []
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            # 取り消し線の引かれた行(開講取りやめなど)は読み込まない
            page = strike_filtered(page)
            words = page.extract_words(x_tolerance=1.2, y_tolerance=1.5, keep_blank_chars=False)
            tables = page.find_tables()
            term_header = next((w for w in words if w['text'] == '開講期'), None)
            if not tables or term_header is None:
                continue
            table = max(tables, key=lambda t: len(t.cells))
            cells = table.cells
            headers = [w for w in words if w['text'] in ('学年', '学科', '授業名', '担当教員', '教室')]
            if not headers:
                continue
            header_y = center(headers[0])[1]
            headers = [w for w in headers if abs(center(w)[1] - header_y) < 4]

            # 時限ごとの列境界(罫線のセルから取る)
            columns, current = [], None
            for head in sorted(headers, key=lambda w: w['x0']):
                cell = smallest_cell(cells, *center(head))
                if head['text'] == '学年':
                    current = {}
                    columns.append(current)
                if cell and current is not None:
                    current[head['text']] = (cell[0], cell[2])
            if not columns:
                continue
            left_end = columns[0]['学年'][0]
            term_x0 = smallest_cell(cells, *center(term_header))[0]

            # 左端の曜日・開講期(結合セルの上下端が適用範囲)
            bands = {'day': [], 'term': []}
            labels = {'day': [], 'term': []}
            for word in words:
                x, y = center(word)
                if y <= header_y + 3 or x >= left_end:
                    continue
                kind = 'term' if x >= term_x0 else 'day'
                labels[kind].append((y, word['text']))
                cell = smallest_cell(cells, x, y)
                if cell is not None:
                    bands[kind].append((cell[1], cell[3], word['text']))

            # 間の罫線がなく1つのセルに複数のラベルが入るときは、ラベルが帯の中央にあることを使って分ける
            for kind, found in bands.items():
                split = []
                for top, bottom in sorted({(b[0], b[1]) for b in found}):
                    inside = sorted((y, b[2]) for b in found if (b[0], b[1]) == (top, bottom)
                                    for y, text in labels[kind] if text == b[2] and top <= y <= bottom)
                    inside = sorted(set(inside))
                    start = top
                    for index, (label_y, text) in enumerate(inside):
                        end = bottom if index == len(inside) - 1 else min(bottom, 2 * label_y - start)
                        split.append((start, end, text))
                        start = end
                bands[kind] = split

            # 表の下端に罫線がないとセルを検出できないので、最も近いラベルで補う
            def band_at(kind, y):
                hit = next((b[2] for b in bands[kind] if b[0] - 0.5 <= y <= b[1] + 0.5), None)
                if hit is None and labels[kind]:
                    hit = min(labels[kind], key=lambda label: abs(label[0] - y))[1]
                return hit

            data_words = [w for w in words if center(w)[1] > header_y + 3 and center(w)[0] >= left_end]
            for period, column in enumerate(columns, 1):
                x_start = min(v[0] for v in column.values())
                x_end = max(v[1] for v in column.values())
                in_col = [w for w in data_words if x_start <= center(w)[0] <= x_end]
                for row in cluster_rows(in_col):
                    y = row['y']
                    if y > table.bbox[3]:
                        # 表の外の注記は読み飛ばす。学年の形の行が落ちるときは気づけるようにする
                        text = ' '.join(w['text'] for w in row['words'])
                        if re.match(r'[1-4](\s*[〜~～]\s*[1-4])?\s', clean(text) + ' '):
                            warnings.append(f'{source} p{page_no} 表の外の行を読み飛ばしました: {clean(text)}')
                        continue
                    fields = {key: [] for key in column}
                    for word in sorted(row['words'], key=lambda w: w['x0']):
                        x = center(word)[0]
                        for key, (a, b) in column.items():
                            if a <= x <= b:
                                fields[key].append(word['text'])
                                break
                    entry = {
                        'grade': clean(''.join(fields.get('学年', []))),
                        'dept': clean(''.join(fields.get('学科', []))),
                        'name': clean(' '.join(fields.get('授業名', []))),
                        'teacher': clean(' '.join(fields.get('担当教員', []))),
                        'room': clean(' '.join(fields.get('教室', []))),
                        'day': band_at('day', y),
                        'term': band_at('term', y),
                        'period': period, 'source': source, 'page': page_no, 'y': y,
                    }
                    if entry['name'] or entry['teacher'] or entry['room']:
                        entries.append(entry)
    return entries


def parse_class_assignment(path):
    """基礎教育科目クラス指定時間割表: (曜日, 時限, 学期, 科目) -> 学科名の一覧"""
    result = {}
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words(x_tolerance=1.2, y_tolerance=1.5)
        table = max(page.find_tables(), key=lambda t: len(t.cells))
        cells = table.cells
        heads = sorted([w for w in words if w['text'] in ('科目名', '配当学科')], key=lambda w: w['x0'])
        head_y = center(heads[0])[1]
        names = [w for w in heads if w['text'] == '科目名']
        depts = [w for w in heads if w['text'] == '配当学科']
        labels = [w for w in words if center(w)[1] > head_y + 3
                  and center(w)[0] < center(names[0])[0] - 20 and w['text'] in tuple(DAYS) + ('前期', '後期')]
        for period, (name_head, dept_head) in enumerate(zip(names, depts), 1):
            name_cell = smallest_cell(cells, *center(name_head))
            dept_cell = smallest_cell(cells, *center(dept_head))
            rows = [w for w in words if center(w)[1] > head_y + 3 and name_cell[0] <= center(w)[0] <= dept_cell[2]]
            for row in cluster_rows(rows):
                y = row['y']
                name = clean(''.join(w['text'] for w in row['words'] if center(w)[0] <= name_cell[2]))
                dept = clean(''.join(w['text'] for w in row['words'] if center(w)[0] > name_cell[2]))
                day = term = None
                for label in labels:
                    cell = smallest_cell(cells, *center(label))
                    if cell and cell[1] - 0.5 <= y <= cell[3] + 0.5:
                        if label['text'] in DAYS:
                            day = label['text']
                        else:
                            term = label['text']
                if name and day and term:
                    result.setdefault((day, period, term, name), []).append(dept)
    return result


def split_dept_label(label):
    out = []
    for part in re.split(r'[・、,]', re.sub(r'\([^)]*\)', '', label)):
        if part in DEPT_ALIASES:
            out.append(DEPT_ALIASES[part])
    return out


def parse_kyoshoku_class(path):
    """教職コースクラス指定科目一覧: (科目, 教員の姓, 学期, 曜日, 時限) -> クラス指定"""
    result = {}
    with pdfplumber.open(path) as pdf:
        for table in pdf.pages[0].extract_tables():
            for row in table:
                row = [clean(c) for c in row]
                if len(row) < 6 or not row[0].isdigit():
                    continue
                _, name, teacher, term, slot, target = row[:6]
                term = '前期' if term.startswith('前') else '後期'
                surname = teacher.split(' ')[0]
                if slot.startswith('集中'):
                    result[(name, surname, term, '集中', 0)] = target
                    continue
                match = re.match(r'(.)曜(\d)時限', slot)
                if not match:
                    warnings.append(f'教職クラス指定の曜時を解釈できません: {row}')
                    continue
                result[(name, surname, term, match.group(1), int(match.group(2)))] = target
    return result


def strike_filtered(page):
    """取り消し線の引かれた文字を除いたページを返す。"""
    bars = []
    for shape in list(page.lines) + list(page.rects):
        if (shape['x1'] - shape['x0']) > 5 and (shape['bottom'] - shape['top']) < 1.5:
            bars.append((shape['x0'], shape['x1'], (shape['top'] + shape['bottom']) / 2))

    def keep(obj):
        if obj.get('object_type') != 'char':
            return True
        height = obj['bottom'] - obj['top']
        low, high = obj['top'] + height * 0.3, obj['top'] + height * 0.7
        x = (obj['x0'] + obj['x1']) / 2
        return not any(a <= x <= b and low <= y <= high for a, b, y in bars)

    return page.filter(keep)


def parse_intensive(path):
    items = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in strike_filtered(page).extract_tables():
                for row in table:
                    row = [(c or '') for c in row]
                    if len(row) < 7 or not clean(row[0]).isdigit():
                        continue
                    # 日付で始まる行は「、」で区切り、文章の折り返しはそのままつなぐ
                    schedule = re.sub(r'\s*\n\s*(?=[\d※])', '、', row[5].strip())
                    schedule = clean(schedule.replace('\n', '')).replace(')v', ')')
                    schedule = re.sub(r'(\d+)/ (\d)', r'\1/\2', schedule)
                    items.append({
                        'category': clean(row[1]),
                        'name': clean(row[2].replace('\n', '')),
                        'teacher': clean(row[3].replace('\n', '')),
                        'term': '前期' if clean(row[4]).startswith('前') else '後期',
                        'schedule': schedule,
                        'place': clean(re.sub(r'\s*\n\s*', '、', row[6])),
                    })
    return items


def normalize_key(text):
    return re.sub(r'[\s()・]', '', clean(text))


def build(folder, marker):
    entries, used = [], []
    for prefix, source in SOURCES:
        path = latest(folder, prefix, marker)
        if path is None:
            warnings.append(f'PDFが見つかりません: {prefix} ({source})')
            continue
        used.append(path.name)
        entries += parse_grid(path, source)

    # 「集中・その他」欄の右に書かれた履修登録の注記は、同じ行の科目に付ける
    notes = [e for e in entries if e['day'] in ('集中', 'その他') and '履修登録' in e['name']]
    entries = [e for e in entries if e not in notes]
    for note in notes:
        same_row = [e for e in entries if e['day'] in ('集中', 'その他') and e['source'] == note['source']
                    and e['page'] == note['page'] and abs(e['y'] - note['y']) < 3]
        if same_row:
            same_row[0]['note'] = note['name'].lstrip('※')
        else:
            warnings.append(f"注記の対応先なし: {note['name']}")

    # 検証と正規化
    rows = []
    for e in entries:
        e['grade'] = e['grade'].replace('・', '〜')
        problems = []
        if not re.fullmatch(r'[1-4](〜[1-4])?', e['grade']):
            problems.append('学年')
        for label, key in (('授業名', 'name'), ('担当教員', 'teacher'), ('教室', 'room')):
            if not e[key]:
                problems.append(label)
        if e['day'] not in tuple(DAYS) + ('集中', 'その他'):
            problems.append('曜日')
        if e['term'] not in ('前', '後', '通年'):
            problems.append('学期')
        if problems:
            warnings.append(f"{e['source']} p{e['page']} {e['day']}{e['period']} {problems}: "
                            f"{e['grade']}|{e['name']}|{e['teacher']}|{e['room']}")
            if {'授業名', '曜日', '学期'} & set(problems):
                continue
        intensive = e['day'] in ('集中', 'その他')
        targets, group = parse_targets(e['name'])
        if e['dept'] in DEPT_ALIASES:
            targets = sorted(set(targets + [DEPT_ALIASES[e['dept']]]))
        rows.append({
            'day': e['day'], 'period': 0 if intensive else e['period'],
            'semester': {'前': '前期', '後': '後期', '通年': '通年'}[e['term']],
            'name': e['name'], 'teacher': e['teacher'], 'room': e['room'],
            'department': e['source'], 'grade': e['grade'], 'targets': targets, 'group': group,
            'schedule': e.get('note', ''),
        })

    # クラス指定の一覧は1〜2年生向け(令和8年度は新カリの学年)なので新カリにだけ反映する
    if marker == '新カリ':
        assign_path = latest_named(folder, '基礎教育科目クラス指定時間割表')
        if assign_path:
            used.append(assign_path.name)
            for (day, period, term, name), labels in parse_class_assignment(assign_path).items():
                matches = [r for r in rows if r['department'] == '基礎教育' and r['day'] == day and r['period'] == period
                           and r['semester'] == term and r['name'].startswith(name)]
                if not matches:
                    warnings.append(f'クラス指定の対応先なし: {day}{period} {term} {name} {labels}')
                if name == '情報リテラシー':
                    if len(matches) == 1 and len(labels) == 1:
                        matches[0]['targets'] = split_dept_label(labels[0])
                        if labels[0] == '再':
                            matches[0]['group'] = '再履修'
                    else:
                        warnings.append(f'情報リテラシーのクラス数が一致しません: {day}{period} {term} '
                                        f'時間割{[m["teacher"] for m in matches]} 指定{labels}')

        for needle in ('クラス指定科目一覧【１年生】', 'クラス指定科目一覧【２年生】'):
            kyoshoku_path = latest_named(folder, needle)
            if not kyoshoku_path:
                warnings.append(f'PDFが見つかりません: {needle}')
                continue
            used.append(kyoshoku_path.name)
            for (name, surname, term, day, period), target in parse_kyoshoku_class(kyoshoku_path).items():
                hits = [r for r in rows if r['department'] == 'コース(教職)' and r['name'] == name and r['semester'] == term
                        and r['day'] == day and r['period'] == period and r['teacher'].startswith(surname)]
                if not hits:
                    warnings.append(f'教職クラス指定の対応先なし: {name} {surname} {term} {day}{period}')
                for row in hits:
                    row['targets'] = split_dept_label(target)
                    row['group'] = target

    # 集中授業一覧の日程を反映(時間割の集中欄と突き合わせ、一覧だけにあるものは追加)
    intensive_path = latest_named(folder, '集中授業一覧')
    if intensive_path:
        used.append(intensive_path.name)
        for item in parse_intensive(intensive_path):
            if marker == '旧カリ' and '令和7年度以降' in item['name']:
                continue
            surname = re.split(r'[ ・]', item['teacher'])[0]
            key = normalize_key(item['name'])
            subject = re.sub(r'^総合(研究|教育)1〜8', '', key)
            hits = [r for r in rows if r['day'] == '集中' and r['semester'] == item['term']
                    and (surname in ('-', '') or r['teacher'].startswith(surname))
                    and re.sub(r'^総合(研究|教育)1〜8', '', normalize_key(r['name']))[:6] == subject[:6]]
            if hits:
                for row in hits:
                    row['schedule'] = item['schedule']
                    row['place'] = item['place']
            else:
                rows.append({
                    'day': '集中', 'period': 0, 'semester': item['term'], 'name': item['name'],
                    'teacher': item['teacher'], 'room': item['place'], 'department': item['category'],
                    'grade': '', 'targets': [], 'group': '', 'schedule': item['schedule'], 'place': item['place'],
                })

    # 完全な重複行を除去
    seen, unique = set(), []
    for row in rows:
        key = json.dumps(row, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique, used


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    folder = Path(args[0])
    order = {d: i for i, d in enumerate(list(DAYS) + ['集中', 'その他'])}
    for marker, output, title in CURRICULA:
        warnings.clear()
        rows, used = build(folder, marker)
        print(f'{marker}: PDF {len(used)} files / {len(rows)} rows / warnings {len(warnings)}')
        for line in warnings:
            print('  !', line)
        if '--check' in sys.argv:
            continue
        rows.sort(key=lambda r: (order[r['day']], r['period'], r['semester'], r['department'], r['name'], r['teacher']))
        compact = []
        for row in rows:
            item = {k: v for k, v in row.items() if v not in ('', [], None)}
            item.setdefault('period', 0)
            compact.append(json.dumps(item, ensure_ascii=False, separators=(',', ':')))
        body = ',\n'.join('  ' + c for c in compact)
        header = json.dumps({
            'generatedBy': 'scripts/parse_timetable.py (直接編集しないでください)',
            'title': title,
            'sources': used,
        }, ensure_ascii=False)
        # 先頭の1行にメタ情報、以降の1行に1授業を置いて差分を読みやすくする
        output.write_text(f'{header[:-1]},"courses":[\n{body}\n]}}\n', encoding='utf-8', newline='\n')
        print('wrote', output.name)


if __name__ == '__main__':
    main()
