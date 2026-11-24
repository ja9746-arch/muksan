"""인명용 한자 표를 만든다 — 묵산작명원 서버만 읽는다(api/_data/hanja.json).

재료(저장소에 넣지 않는다, 내려받아 돌린다)
  - 대법원 인명용 한자 코드: github.com/delvier/KoreaSCourtCode 의 webhanja.db
      글자·인명용 여부·허용 음·뜻·강희 부수 번호·부수 밖 획수
  - Unihan(unicode.org): kTotalStrokes(필획)
  - 뜻이 비어 있는 글자는 github.com/rutopio/Korean-Name-Hanja-Charset(MIT)의 data-naver.csv 로 채운다

원획(작명에서 쓰는 획수)
  강희자전 부수의 본래 획수 + 부수 밖 획수. 氵=水 4, 扌=手 4, 忄=心 4, 王=玉 5, 月(肉)=6, 艹=艸 6,
  辶=辵 7, 阝(왼)=阜 8, 阝(오른)=邑 7 처럼 줄인 꼴을 본래 꼴로 센다.
  - 글자 자체가 부수인 것(부수 밖 0획)은 제 획수 그대로 — 王은 4, 玉은 5
  - 부수가 본래 꼴보다 길게 들어간 글자(泰 등)는 필획이 더 크므로 둘 중 큰 쪽
  - 수를 뜻하는 글자는 그 수로: 一1 二2 三3 四4 五5 六6 七7 八8 九9 十10

자원오행
  부수에 따라 다섯 기운 가운데 하나를 준다(api/_data 의 부수표, tools/radical-ohaeng.json).
  천간·지지 글자와 부수만으로 어긋나는 몇 글자는 tools/jawon-fix.json 으로 덮는다.
  작명가마다 갈리는 글자가 있다 — 화면에 '부수 기준'이라고 밝힌다.
"""
import sqlite3, json, csv, sys, re, os
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/msk/dl'
HERE = os.path.dirname(os.path.abspath(__file__))

def kx_strokes(rad):
    for lo, hi, n in [(1,6,1),(7,29,2),(30,60,3),(61,94,4),(95,117,5),(118,146,6),(147,166,7),(167,175,8),
                      (176,186,9),(187,194,10),(195,200,11),(201,204,12),(205,208,13),(209,210,14),(211,211,15),(212,213,16),(214,214,17)]:
        if lo <= rad <= hi: return n
    raise ValueError(rad)

tot = {}
for line in open(f'{SRC}/unihan/Unihan_IRGSources.txt', encoding='utf8'):
    if '\tkTotalStrokes\t' in line:
        cp, _, v = line.rstrip('\n').split('\t')
        tot[chr(int(cp[2:], 16))] = max(int(x) for x in v.split())

naver = {}
with open(f'{SRC}/Korean-Name-Hanja-Charset/data-naver.csv', encoding='utf8') as f:
    for r in csv.DictReader(f):
        naver.setdefault(r['hanja'], []).append(r['meaning'].strip())

RAD = json.load(open(f'{HERE}/radical-ohaeng.json', encoding='utf8'))
FIX = json.load(open(f'{HERE}/jawon-fix.json', encoding='utf8'))
# 成(7획)이 든 글자 — 부수 셈으로는 한 획이 모자라게 나온다
WON_FIX = {'城':10,'誠':14,'盛':12,'晟':11,'宬':10,'珹':12,'娍':10,'筬':13,'郕':14,'鋮':15}
NUM = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}

def meanings(inm, ch):
    """'서 : 상서(서) 홀(서)' → [['서', ['상서','홀']]] / 여러 음이면 '률,율: 법(률)' 꼴"""
    out = []
    if inm and ':' in inm:
        head, body = inm.split(':', 1)
        hun = [m.group(1).strip() for m in re.finditer(r'([^()\s][^()]*?)\(([^()]+)\)', body)]
        hun = [h for h in hun if h]
        return hun
    return []

db = sqlite3.connect(f'{SRC}/KoreaSCourtCode/webhanja.db')
rows = db.execute("""select h.cd, h.type, h.inm, h.ineum, r.rad_id, r.stroke from hanja_info h
                     join rad_stroke r on r.cd = h.cd where h.isin = 1 and h.type in ('0','2') order by h.cd, r.rowid""").fetchall()
seen, out, nomean = set(), [], 0
for cd, typ, inm, ineum, rad, rem in rows:
    if cd in seen: continue
    seen.add(cd)
    ch = chr(int(cd, 16))
    eum = [e.strip() for e in (ineum or '').split(',') if e.strip()]
    if not eum: continue
    won = kx_strokes(rad) + rem
    pil = tot.get(ch)
    if rem == 0 and pil: won = pil
    elif pil and pil > won: won = pil
    if ch in NUM: won = NUM[ch]
    if ch in WON_FIX: won = WON_FIX[ch]
    hun = meanings(inm, ch)
    if not hun and ch in naver:
        # '옳을 가' → '옳을'
        hun = [re.sub(r'\s*\S+$', '', m).strip() for m in naver[ch][0].split(',')]
        hun = [h for h in hun if h]
    if not hun: nomean += 1
    el = FIX.get(ch) or RAD[str(rad)]
    out.append([ch, eum, hun[:3], won, el, rad, pil or 0])

json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else f'{HERE}/../api/_data/hanja.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print('글자', len(out), '뜻 없음', nomean)
