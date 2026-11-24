/* 묵산작명원 엔진 — 이름을 짓고, 지어 둔 이름을 감정한다.
 *
 * 사주 셈은 백귀사주와 같은 saju-core.js 를 그대로 쓴다(손대지 않는다). 여기서 하는 것은
 * 그 여덟 글자를 다섯 기운으로 세어 이름이 채울 기운을 정하고, 이름을 열 가지 잣대로 재는 일이다.
 *
 * 열 가지 잣대
 *   ① 사주 보완   이름 글자의 자원오행이 사주에 모자란 기운(용신·희신)을 채우나
 *   ② 글자 뿌리   성 → 이름 첫 자 → 끝 자의 자원오행이 서로 살리나
 *   ③ 수리 사격   원·형·이·정 네 격이 81수에서 길한 수인가
 *   ④ 음양        획수의 홀짝이 한쪽으로 몰리지 않았나
 *   ⑤ 소리 오행   첫소리의 오행이 서로 살리나 — 두 학설(운해본·훈민정음 해례본)로 따로 본다
 *   ⑥ 부르는 맛   같은 소리 되풀이·받침이 넘어가며 소리가 바뀌는 곳
 *   ⑦ 뜻          한자 뜻이 맑은가
 *   ⑧ 인명용 한자  대법원 인명용 한자 표에 그 음으로 올라 있나(출생신고가 되나)
 *   ⑨ 흔한 정도   2025년 출생신고 상위 스무 이름 안에 드나
 *   ⑩ 놀림·피하는 글자  놀림말로 들리나, 옛 작명서가 피하라던 글자인가
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import * as SJ from './saju-core.js'
import { BARAM, NAMEK } from '../_data/baram.js'
import { POOL, NAMES, TOP2025, SURNAMES, AVOID, TEASE } from '../_data/pool.js'

/* ───────── 글자 표 ───────── */
const RAW = JSON.parse(fs.readFileSync(new URL('../_data/hanja.json', import.meta.url), 'utf8'))
const BY = new Map()
/* 대법원 자료가 일본식 코드로 적은 글자를 한국에서 쓰는 표준 글자(KS X 1001)로 바꾼다 — 姫→姬(계집 희), 晚→晩(늦을 만), 凑→湊(모일 주).
   손님 휴대폰·출생신고 서류에 찍히는 글자와 같게 하려는 것이다 */
const KS_FORM = { '姫': '姬', '晚': '晩', '凑': '湊' }
for (const r of RAW) if (KS_FORM[r[0]]) r[0] = KS_FORM[r[0]]
for (const [h, eum, hun, won, el, rad] of RAW) BY.set(h, { h, eum, hun, won, el, rad })
export const HANJA_COUNT = RAW.length

const POOLMAP = {}            // 소리 → [{h, k(뜻말)}]
const POOLKEY = new Map()     // 글자 → 뜻말
for (const [eum, s] of Object.entries(POOL)) {
  POOLMAP[eum] = s.split(/ (?=\S:)/).map(t => { const i = t.indexOf(':'); return { h: t.slice(0, i), k: t.slice(i + 1) } })
  for (const x of POOLMAP[eum]) POOLKEY.set(x.h, x.k)
}
const EUM = new Map()         // 소리 → 글자들(이름에 자주 쓰는 글자 먼저)
for (const r of BY.values()) for (const e of r.eum) { if (!EUM.has(e)) EUM.set(e, []); EUM.get(e).push(r) }
/* 고르는 칸 차례 — 이름에 쓰는 글자 → 흔히 쓰는 글자(한국 표준 한자 4,888자 안) → 나머지, 그 안에서는 획수 적은 순.
   뜻 자료가 없는 글자(대부분 확장 영역의 드문 글자)는 고르는 칸에 내지 않는다 — 뜻을 모르는 글자로 이름을 짓거나 잴 수 없다 */
const KS = new Set(JSON.parse(fs.readFileSync(new URL('../_data/ks.json', import.meta.url), 'utf8')))
for (const h of Object.values(KS_FORM)) KS.add(h)
for (const [e, list] of EUM) list.sort((a, b) => (POOLKEY.has(b.h) - POOLKEY.has(a.h)) || (KS.has(b.h) - KS.has(a.h)) || a.won - b.won)

/** 한 소리에 쓸 수 있는 인명용 한자(감정·성씨 고르기 화면용) */
export function hanjaFor(eum, limit = 120) {
  return (EUM.get(eum) || []).filter(r => r.hun.length).slice(0, limit).map(r => ({ h: r.h, hun: r.hun.join(', '), won: r.won, el: r.el, pool: POOLKEY.has(r.h) }))
}

/* ───────── 다섯 기운 ───────── */
const EL = ['木', '火', '土', '金', '水']
const ELKO = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' }
const ELI = Object.fromEntries(EL.map((e, i) => [e, i]))
const gen = e => EL[(ELI[e] + 1) % 5]      // e 가 살리는 것
const ctl = e => EL[(ELI[e] + 2) % 5]      // e 가 누르는 것
const genBy = e => EL[(ELI[e] + 4) % 5]    // e 를 살리는 것
const ctlBy = e => EL[(ELI[e] + 3) % 5]    // e 를 누르는 것
function rel(a, b) {
  if (a === b) return 'same'
  if (gen(a) === b) return 'gen'      // a 가 b 를 살림
  if (gen(b) === a) return 'genr'     // b 가 a 를 살림
  return 'ctl'                        // 서로 누름(어느 쪽이든)
}
const RELKO = { same: '같은 기운이라 힘이 겹칩니다', gen: '앞 글자가 뒤 글자를 살려 줍니다', genr: '뒤 글자가 앞 글자를 살려 줍니다', ctl: '서로 부딪칩니다' }
const SK_EL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
const BR_EL = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']
/* 지장간 — 땅 글자 속 하늘 글자와 머무는 날수(여기·중기·본기). 하늘 글자 번호 甲0 乙1 丙2 丁3 戊4 己5 庚6 辛7 壬8 癸9 */
const JIJANG = [
  [[8, 10], [9, 20]],            // 子 壬10 癸20
  [[9, 9], [7, 3], [5, 18]],     // 丑 癸9 辛3 己18
  [[4, 7], [2, 7], [0, 16]],     // 寅 戊7 丙7 甲16
  [[0, 10], [1, 20]],            // 卯 甲10 乙20
  [[1, 9], [9, 3], [4, 18]],     // 辰 乙9 癸3 戊18
  [[4, 7], [6, 7], [2, 16]],     // 巳 戊7 庚7 丙16
  [[2, 10], [5, 9], [3, 11]],    // 午 丙10 己9 丁11
  [[3, 9], [1, 3], [5, 18]],     // 未 丁9 乙3 己18
  [[4, 7], [8, 7], [6, 16]],     // 申 戊7 壬7 庚16
  [[6, 10], [7, 20]],            // 酉 庚10 辛20
  [[7, 9], [3, 3], [4, 18]],     // 戌 辛9 丁3 戊18
  [[4, 7], [0, 7], [8, 16]],     // 亥 戊7 甲7 壬16
]

/* ───────── 한글 ───────── */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const isHangul = c => { const k = c.charCodeAt(0); return k >= 0xAC00 && k <= 0xD7A3 }
const parts = c => { const k = c.charCodeAt(0) - 0xAC00; return { cho: CHO[Math.floor(k / 588)], jung: Math.floor((k % 588) / 28), jong: JONG[k % 28] } }
const BAT = { 0: 1, 1: 1, 3: 1, 6: 1, 7: 1, 8: 1 } // 영 일 삼 육 칠 팔 — 받침 있는 숫자 끝
function batchim(word) {
  const s = String(word).replace(/\([^()]*\)$/, '').replace(/[\s)）」』"'.,·]+$/, ''); const c = s.slice(-1)
  if (!c) return false
  if (isHangul(c)) return parts(c).jong !== ''
  if (/[0-9]/.test(c)) return !!BAT[c]
  return false
}
const rieul = word => { const c = String(word).slice(-1); return isHangul(c) && parts(c).jong === 'ㄹ' }
export const J = {
  을: w => w + (batchim(w) ? '을' : '를'), 이: w => w + (batchim(w) ? '이' : '가'), 은: w => w + (batchim(w) ? '은' : '는'),
  과: w => w + (batchim(w) ? '과' : '와'), 으로: w => w + (batchim(w) && !rieul(w) ? '으로' : '로'), 이다: w => w + (batchim(w) ? '입니다' : '입니다'),
}

/* 소리 오행 — 두 학설 */
const SOUND = {
  운해: { ㄱ: '木', ㅋ: '木', ㄴ: '火', ㄷ: '火', ㄹ: '火', ㅌ: '火', ㅇ: '土', ㅎ: '土', ㅅ: '金', ㅈ: '金', ㅊ: '金', ㅁ: '水', ㅂ: '水', ㅍ: '水' },
  해례: { ㄱ: '木', ㅋ: '木', ㄴ: '火', ㄷ: '火', ㄹ: '火', ㅌ: '火', ㅁ: '土', ㅂ: '土', ㅍ: '土', ㅅ: '金', ㅈ: '金', ㅊ: '金', ㅇ: '水', ㅎ: '水' },
}
const plainCho = c => ({ ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }[c] || c)
const soundEl = (syl, school) => SOUND[school][plainCho(parts(syl).cho)]

/* ───────── 81수 ───────── */
// 격 이름 읽는 소리 — 화면에는 '허망격(虛妄格)'처럼 한글을 앞에
const SU_RD = '태초 분리 명예 부정 복수 계성 독립 발달 궁박 공허 흥가 박약 지모 이산 통솔 덕망 건창 융창 고난 허망 두령 중절 공명 입신 안강 영웅 중단 파란 성공 부몽 융창 순풍 승천 파멸 태평 의협 출세 복록 안락 무상 대공 고행 미혹 마장 현달 곤궁 전개 영달 변화 상반 성쇠 승룡 우수 무공 미달 부족 시래 후영 불성 암흑 재리 쇠퇴 길상 침체 휘양 망신 천복 명지 정지 멸망 만달 후곤 평길 불우 적시 후성 전후 평복 불신 은둔 환원'.split(' ')
const SU = `1 太初 1 모든 일의 첫머리라 바탕이 굳고 크게 이룹니다
2 分離 0 힘이 갈라지고 흩어져 한데 모이지 않습니다
3 名譽 1 슬기와 재주로 이름을 얻습니다
4 不定 0 기틀이 흔들려 고생이 잦습니다
5 福壽 1 복과 수를 함께 누리고 집안이 넉넉합니다
6 繼成 1 받은 덕을 이어 차곡차곡 쌓아 갑니다
7 獨立 1 굳센 뜻으로 홀로 서서 일을 이룹니다
8 發達 1 꾸준한 힘으로 끝내 뜻을 펼칩니다
9 窮迫 0 애써도 거두는 것이 적고 막힘이 많습니다
10 空虛 0 속이 비어 쌓은 것이 쉽게 흩어집니다
11 興家 1 집안을 일으키고 차츰 번창합니다
12 薄弱 0 뜻은 크나 힘이 모자라 꺾이기 쉽습니다
13 智謀 1 꾀와 지혜가 밝아 어려움을 풀어 갑니다
14 離散 0 가까운 사이가 흩어지고 외로움이 따릅니다
15 統率 1 사람을 거느리고 위아래가 잘 따릅니다
16 德望 1 덕망으로 사람을 모으고 귀하게 됩니다
17 健暢 1 굳세게 밀고 나가 뜻을 이룹니다
18 隆昌 1 뜻을 세워 크게 일어섭니다
19 苦難 0 재주는 있으나 고비가 잦습니다
20 虛妄 0 이룬 일이 허무하게 무너지기 쉽습니다
21 頭領 1 남의 위에 서서 이끄는 우두머리 수입니다
22 中折 0 일이 중간에 꺾이기 쉽습니다
23 功名 1 공을 세워 이름을 크게 떨칩니다
24 立身 1 맨손으로 일어서 재물을 모읍니다
25 安康 1 재주와 슬기로 편안하게 이룹니다
26 英雄 0 큰 뜻을 품으나 풍파가 커 굴곡이 많습니다
27 中斷 0 잘 나가다 중간에 막히기 쉽습니다
28 波瀾 0 풍파가 잦아 편할 날이 적습니다
29 成功 1 지혜와 재물을 함께 얻어 뜻을 이룹니다
30 浮夢 0 뜬구름처럼 들고 남이 커 기복이 심합니다
31 隆昌 1 지혜와 덕으로 집안을 크게 일으킵니다
32 順風 1 뜻밖의 도움을 받아 순풍처럼 나아갑니다
33 昇天 1 기세가 하늘에 오를 만큼 크게 떨칩니다
34 破滅 0 뜻밖의 화로 이룬 것을 잃기 쉽습니다
35 泰平 1 온화하고 평탄하게 이뤄 갑니다
36 義俠 0 의리는 깊으나 풍파가 따릅니다
37 出世 1 성실함으로 이름을 얻고 높이 오릅니다
38 福祿 1 재주와 글솜씨로 복록을 누립니다
39 安樂 1 부귀와 영화를 누리는 수입니다
40 無常 0 들고 남이 잦아 오래 지키기 어렵습니다
41 大功 1 덕과 슬기로 큰 공을 세웁니다
42 苦行 0 재주는 많으나 끝을 맺기 어렵습니다
43 迷惑 0 겉은 화려하나 속이 비기 쉽습니다
44 魔障 0 마가 끼어 일이 자주 어그러집니다
45 顯達 1 뜻이 크고 깊어 크게 이름을 냅니다
46 困窮 0 애쓴 만큼 거두기 어렵습니다
47 展開 1 하는 일마다 펼쳐지고 열매를 맺습니다
48 榮達 1 덕과 지혜로 남을 이끌고 영달합니다
49 變化 0 길흉이 엇갈려 변화가 많습니다
50 相半 0 한 번 이루면 한 번 잃는 수입니다
51 盛衰 0 성하고 쇠함이 번갈아 옵니다
52 昇龍 1 앞을 내다보는 눈으로 크게 일어섭니다
53 憂愁 0 겉보기와 달리 속근심이 많습니다
54 無功 0 애써도 공이 돌아오지 않습니다
55 未達 0 다 된 일이 마지막에 어그러지기 쉽습니다
56 不足 0 뜻을 펴기에 힘이 모자랍니다
57 時來 1 어려움 뒤에 때를 만나 크게 이룹니다
58 後榮 1 처음은 고되나 뒤에 영화가 옵니다
59 不成 0 뜻을 세워도 이루기 어렵습니다
60 暗黑 0 앞이 어두워 길을 잃기 쉽습니다
61 財利 1 재물과 이름을 함께 얻습니다
62 衰退 0 기운이 차츰 줄어듭니다
63 吉祥 1 만사가 뜻대로 풀리는 수입니다
64 沈滯 0 일이 막히고 고이기 쉽습니다
65 輝揚 1 집안이 두루 번창합니다
66 亡身 0 안팎으로 어려움이 겹칩니다
67 天福 1 하늘의 복으로 뜻을 이룹니다
68 明智 1 슬기롭고 부지런해 집안을 일으킵니다
69 停止 0 일이 멈추고 나아가지 못합니다
70 滅亡 0 공허함이 커 쌓기 어렵습니다
71 晩達 1 힘써 나아가면 차츰 펼쳐집니다
72 後困 0 처음은 좋으나 뒤가 고됩니다
73 平吉 1 크게 오르지는 않아도 평탄합니다
74 不遇 0 때를 못 만나 재주를 못 씁니다
75 適時 1 때를 맞추면 무난히 이룹니다
76 後成 0 처음이 고되고 늦게야 풀립니다
77 前後 0 앞이 좋으면 뒤가 고되고 뒤가 좋으면 앞이 고됩니다
78 平福 0 중년까지는 좋으나 말년이 쓸쓸합니다
79 不信 0 믿음을 얻기 어렵습니다
80 隱遁 0 물러나 숨는 수입니다
81 還元 1 처음으로 돌아가 다시 크게 일어납니다`.split('\n').map(l => { const [n, nm, g, ...t] = l.split(' '); return { n: +n, nm: nm + '格', rd: SU_RD[+n - 1] + '격', gil: g === '1', t: t.join(' ') } })
const su = n => { let k = n; while (k > 81) k -= 80; return SU[k - 1] }
const SUKO = { 元: '원격', 亨: '형격', 利: '이격', 貞: '정격' }
const SUPLAIN = { 元: '어린 시절(태어나 스무 살 무렵)', 亨: '젊은 날(스물부터 마흔 무렵)', 利: '한창때(마흔부터 예순 무렵)', 貞: '평생 전체' }
const SUAGE = { 元: '초년 — 태어나 스무 살 무렵까지', 亨: '청년 — 스물부터 마흔 무렵', 利: '중년 — 마흔부터 예순 무렵', 貞: '말년 — 평생을 묶는 총운' }

/** 네 격. 성 획수(복성은 합), 이름 글자 획수 배열 */
export function sagyeok(sw, gw) {
  const g = gw.reduce((a, b) => a + b, 0)
  let o
  if (gw.length === 1) o = { 元: gw[0], 亨: sw + gw[0], 利: sw, 貞: sw + gw[0] }
  else o = { 元: g, 亨: sw + gw[0], 利: sw + gw[gw.length - 1], 貞: sw + g }
  return ['元', '亨', '利', '貞'].map(k => ({ k, ko: SUKO[k], age: SUAGE[k], n: o[k], ...su(o[k]) }))
}

/* ───────── 사주 ───────── */
const STEM_TXT = ['큰 나무처럼 곧게 뻗는', '풀과 덩굴처럼 휘어도 꺾이지 않는', '한낮의 해처럼 환하게 드러나는', '등불처럼 가까이를 따뜻하게 비추는', '큰 산처럼 무겁고 믿음직한',
  '기름진 밭처럼 품이 넓은', '무쇠처럼 굳고 결단이 빠른', '다듬은 보석처럼 섬세하고 깔끔한', '큰 강처럼 넓게 흐르는', '이슬비처럼 조용히 스며드는']

function pillarsOf(b, noon = false) {
  const n = SJ.normalizeBirthData({
    gender: b.sex === '여' ? 'female' : 'male', calendarType: b.cal === '양력' ? 'solar' : 'lunar', isLeapMonth: b.cal === '윤달',
    year: b.y, month: b.m, day: b.d, ...(noon ? { hour: 12, minute: 0 } : b.h == null ? { birthTimeUnknown: true } : { hour: b.h, minute: b.mi || 0 }), timezone: 'Asia/Seoul',
  })
  if (!n.ok) return null
  const P = SJ.calculateFourPillars(n.data)
  const one = x => x && x.kind === 'pillar' ? x : null
  const cols = ['hour', 'day', 'month', 'year'].map(k => one(P[k]))
  /* 절기가 바뀌는 날에 태어난 시를 모르면 달(해) 기둥이 둘로 갈려 엔진이 비워 둔다 — 한낮으로 세고 그렇다고 적는다 */
  if ((!cols[2] || !cols[3]) && b.h == null && !noon) { const r = pillarsOf(b, true); if (r) { r.cols[0] = null; r.termDay = true } return r }
  if (!cols[1] || !cols[2] || !cols[3]) return null
  return { cols, solar: P.calendarContext?.solarDate || null, lunar: P.calendarContext?.lunarDate || null }
}

/** 사주를 다섯 기운으로 세고, 이름이 채울 기운을 정한다 */
export function sajuOf(b) {
  const p = pillarsOf(b); if (!p) return null
  const [hr, dy, mo, yr] = p.cols
  const cnt = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }, raw = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  for (const c of [yr, mo, dy, hr]) if (c) { raw[SK_EL[c.stem.index]] += 1; raw[BR_EL[c.branch.index]] += 1 }
  /* 세기 — 자리마다 무게가 다르고, 땅 글자는 본기를 주로, 속에 든 다른 기운(지장간)을 조금 셈한다.
     하늘 글자 10, 땅 글자 10, 달 땅 글자(월령) 30, 날 땅 글자 20 — 모두 100. 태어난 날의 하늘 글자(나 자신)는 세지 않는다. */
  const put = (c, w, isStem) => {
    if (isStem) { cnt[SK_EL[c.stem.index]] += w; return }
    // 땅 글자는 본기(가장 오래 머무는 기운)에 무게의 4/5, 나머지 지장간에 날수대로 1/5 — 亥가 반쯤 흙으로 셈되는 일이 없게
    const hid = JIJANG[c.branch.index], main = hid[hid.length - 1], rest = hid.slice(0, -1), rs = rest.reduce((a, [, d]) => a + d, 0)
    cnt[SK_EL[main[0]]] += w * (rest.length ? 0.8 : 1)
    for (const [si, d] of rest) cnt[SK_EL[si]] += w * 0.2 * d / rs
  }
  for (const c of [yr, mo, hr]) if (c) put(c, 10, true)
  for (const c of [yr, mo, dy, hr]) if (c) put(c, c === mo ? 30 : c === dy ? 20 : 10, false)
  const dm = SK_EL[dy.stem.index]
  const total = Object.values(cnt).reduce((a, b) => a + b, 0)
  const help = cnt[dm] + cnt[genBy(dm)]
  const ratio = help / total
  const strong = ratio > 0.54 ? '강' : ratio < 0.46 ? '약' : '중'
  let yong, why
  if (strong === '약') {
    const a = genBy(dm), b2 = dm
    yong = cnt[a] <= cnt[b2] ? a : b2
    why = `타고난 바탕(${ELKO[dm]})이 둘레 기운에 비해 여립니다. 바탕을 받쳐 줄 ${ELKO[yong]} 기운이 이름에 들어가야 합니다.`
  } else if (strong === '강') {
    const out = gen(dm), money = ctl(dm), rule = ctlBy(dm)
    if (cnt[genBy(dm)] > cnt[dm]) { yong = money; why = `바탕을 감싸는 기운이 지나치게 두텁습니다. 그 두터움을 덜어 쓰는 ${ELKO[yong]} 기운이 이름에 들어가야 합니다.` }
    else { yong = [out, money, rule].sort((x, y) => cnt[x] - cnt[y])[0]; why = `바탕(${ELKO[dm]})이 넘칠 만큼 굳셉니다. ${yong === out ? '그 힘을 밖으로 풀어 줄' : yong === money ? '그 힘을 부려 쓸 거리가 되는' : '그 힘을 다잡아 줄'} ${ELKO[yong]} 기운이 이름에 들어가야 합니다.` }
  } else {
    // 고른 사주는 계절(조후)을 먼저 본다 — 겨울 달에 불이 엷으면 불, 여름 달에 물이 엷으면 물. 아니면 가장 엷은 기운
    const mb0 = mo.branch.index
    const season = [11, 0, 1].includes(mb0) && cnt['火'] < total * 0.15 ? '火' : [5, 6, 7].includes(mb0) && cnt['水'] < total * 0.15 ? '水' : null
    if (season) { yong = season; why = `바탕과 둘레 기운이 고르게 맞섭니다. 다만 ${season === '火' ? '찬 계절에 태어나 몸을 데울 불' : '더운 계절에 태어나 열을 식힐 물'} 기운이 엷어 그것을 이름으로 채웁니다.` }
    else {
      yong = EL.slice().sort((x, y) => cnt[x] - cnt[y] || ELI[x] - ELI[y])[0]
      why = `바탕과 둘레 기운이 고르게 맞섭니다. 가장 엷은 ${ELKO[yong]} 기운을 이름으로 채워 고르기를 맞춥니다.`
    }
  }
  /* 희신 — 용신을 거드는 기운. 넘치는 쪽(바탕과 바탕을 살리는 기운)이 희신이 되지 않게 고른다.
     약하면 인성·비겁 가운데 용신이 아닌 쪽, 강하면 설기(식상)·재성 가운데 용신이 아닌 쪽(관성이 용신이면 재성) */
  let hee
  if (strong === '약') hee = yong === dm ? genBy(dm) : dm
  else if (strong === '강') hee = yong === gen(dm) ? ctl(dm) : gen(dm)
  else { const g = genBy(yong); hee = (g === dm || g === genBy(dm)) && cnt[g] >= total * 0.3 ? gen(yong) : g }
  const gi = ctlBy(yong)
  // 조후 — 겨울 달은 불, 여름 달은 물
  const mb = mo.branch.index
  let johu = null
  if ([11, 0, 1].includes(mb) && cnt['火'] < total * 0.12) johu = '火'
  if ([5, 6, 7].includes(mb) && cnt['水'] < total * 0.12) johu = '水'
  if (johu === gi) johu = null   // 조후가 꺼릴 기운과 겹치면 억부(용신)를 따른다 — 한 사주에 '채워라'와 '피하라'를 같이 말하지 않는다
  const lack = EL.filter(e => raw[e] === 0)
  const over = EL.filter(e => cnt[e] >= total * 0.38)
  return {
    cols: p.cols.map(c => c ? { s: c.stem.hanja, b: c.branch.hanja, sk: c.stem.korean, bk: c.branch.korean, se: SK_EL[c.stem.index], be: BR_EL[c.branch.index] } : null),
    solar: p.solar, lunar: p.lunar, hourKnown: !!hr, termDay: !!p.termDay,
    cnt, raw, dm, dmTxt: STEM_TXT[dy.stem.index], dmHj: dy.stem.hanja, strong, ratio: Math.round(ratio * 100),
    yong, hee, gi, johu, lack, over, why,
  }
}
export function sajuText(s) {
  const L = []
  L.push(`태어난 날의 하늘 글자는 ${s.dmHj}(${ELKO[s.dm]}) — ${s.dmTxt} 바탕입니다.`)
  const order = EL.slice().sort((a, b) => s.raw[b] - s.raw[a] || s.cnt[b] - s.cnt[a])
  L.push(`여덟 글자${s.hourKnown ? '' : '(태어난 시를 몰라 여섯 글자)'}를 다섯 기운으로 세면 ${order.map(e => `${ELKO[e]} ${s.raw[e]}`).join(' · ')}입니다.${s.lack.length ? ` ${s.lack.map(e => ELKO[e]).join('·')} 기운은 한 글자도 없습니다.` : ''}`)
  if (s.termDay) L.push('태어난 날이 절기가 바뀌는 날이라, 태어난 시를 모르면 달 기둥이 둘 중 하나로 갈립니다. 한낮에 태어난 것으로 셌습니다 — 시를 알면 넣어 주십시오.')
  { const mo = s.cols[2], dy = s.cols[1]
    L.push(`나를 돕는 기운(같은 기운과 나를 살리는 기운)이 100 가운데 ${s.ratio}${[0, 3, 6].includes(s.ratio % 10) ? '으로' : '로'} ${s.strong === '강' ? '넘치는' : s.strong === '약' ? '모자란' : '고른'} 편입니다. 글자 수보다 자리가 무거워, 태어난 달의 땅 글자 ${mo.b}(${mo.bk}·${ELKO[mo.be]})${batchim(mo.bk) ? '이' : '가'} 30, 날의 땅 글자 ${dy.b}(${dy.bk}·${ELKO[dy.be]})${batchim(dy.bk) ? '이' : '가'} 20, 나머지 글자는 10씩으로 셌습니다.`) }
  L.push(s.why)
  if (s.johu && s.johu !== s.yong) L.push(`${s.johu === '火' ? '찬 계절에 태어나 몸을 데울 불' : '더운 계절에 태어나 열을 식힐 물'} 기운도 함께 챙기면 좋습니다.`)
  L.push(`그래서 이름 글자는 ${J.을(ELKO[s.yong] + '(' + s.yong + ')')} 가장 먼저, ${J.을(ELKO[s.hee] + '(' + s.hee + ')')} 그다음으로 담고, ${ELKO[s.gi]}(${s.gi}) 기운은 피해서 고릅니다.`)
  return L
}

/* ───────── 입력 ───────── */
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null }
export function cleanInput(x) {
  if (!x || typeof x !== 'object') return null
  const kind = ['baby', 'rename', 'gamjeong', 'manse'].includes(x.kind) ? x.kind : null
  if (!kind) return null
  const sex = x.sex === '여' ? '여' : x.sex === '남' ? '남' : null
  const cal = ['양력', '음력', '윤달'].includes(x.cal) ? x.cal : '양력'
  const y = int(x.y, 1920, 2030), m = int(x.m, 1, 12), d = int(x.d, 1, 31)
  const h = x.h === null || x.h === '' || x.h === undefined ? null : int(x.h, 0, 23)
  const mi = h == null ? 0 : (int(x.mi, 0, 59) ?? 0)
  if (!sex || !y || !m || !d) return null
  const o = { kind, sex, cal, y, m, d, h, mi }
  if (kind === 'manse') return o
  const sur = clip(x.sur, 2)
  if (!SURNAMES[sur]) return null
  const opts = Array.isArray(SURNAMES[sur]) ? SURNAMES[sur] : [...SURNAMES[sur]]
  o.sur = sur; o.surHj = opts.includes(x.surHj) ? x.surHj : opts[0]
  if (kind === 'gamjeong' || (kind === 'rename' && x.given)) {
    const given = clip(x.given, 4), gh = [...clip(x.givenHj, 4)]
    if (kind === 'gamjeong' && (!given || ![...given].every(isHangul) || given.length < 1 || given.length > 3)) return null
    if (given) {
      if (![...given].every(isHangul) || gh.length !== given.length) return null
      // 한자마다 그 소리로 읽히는 인명용 한자인지 — 민(敏)은 되고 민(哲)은 안 된다
      if (gh.some((h, i) => !BY.get(h)?.eum.includes([...given][i]))) return null
      o.given = given; o.givenHj = gh.join('')
    }
  }
  if (kind === 'baby' || kind === 'rename') {
    const dk = clip(x.dolKo, 1), dh = clip(x.dolHj, 1), dp = int(x.dolPos, 1, 2)
    if (dk && dh && dp && isHangul(dk) && BY.get(dh)?.eum.includes(dk)) { o.dolKo = dk; o.dolHj = dh; o.dolPos = dp }
    const W = Object.keys(WISH)
    o.wish = (Array.isArray(x.wish) ? x.wish : []).filter(w => W.includes(w)).slice(0, 2)
  }
  return o
}
export const fingerprint = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('base64url').slice(0, 24)
const birthOf = o => ({ sex: o.sex, cal: o.cal, y: o.y, m: o.m, d: o.d, h: o.h, mi: o.mi })

/* 바라는 뜻 — 고르면 그 뜻을 담은 글자를 앞에 세운다(점수 열 잣대와는 따로) */
export const WISH = {
  밝음: '昭炫晟熙暻景晶燦赫煥朗晤旿昀晛彬斌炅璟鎬皓明星',
  지혜: '智睿叡慧悟敏知賢哲',
  굳셈: '健建桓峻埈泰太浩勝駿',
  넉넉함: '裕優多寶珍銀珉珠潤富',
  바름: '正貞義道仁善誠眞律準範宜',
  평안: '安晏穩溫柔靜宥',
  큰뜻: '成志承昇宇宙奎元源翰英',
  고움: '佳嘉姸娟娜雅媛瑜璘璐蓮婉娥',
}

/* ───────── 잣대 ───────── */
const W = { 사주: 15, 뿌리: 8, 수리: 15, 음양: 8, 소리: 12, 부름: 8, 뜻: 12, 인명: 10, 흔함: 4, 놀림: 8 }
/* 어두운 뜻 — 훈(뜻) 하나하나를 따로 본다. '고울'의 '울'처럼 낱말 속에 든 글자로 잘못 걸리지 않게
   긴 말은 들어 있으면, 한 글자 말은 그 낱말이 통째로 같을 때만 건다 */
const BADSUB = /죽을|병들|슬플|슬퍼할|근심|망할|어두울|거짓|독할|악할|흉할|해칠|도둑|미칠|어리석|천할|괴로울|가난|외로울|버릴|잃을|쇠할|원망|시기할|무덤|상복|재앙|귀신|벌레|요사|간사|음란|사나울|게으를|더러울|부끄러울|싸울|찌를|아플|짐승|모자랄|헛될|막힐|떨어질|흩어질|울부짖|곡할|죄|형벌|오줌|똥/
const BADWORD = new Set(['울', '쥐', '칠', '피', '병', '뱀', '종', '때릴', '벨', '베일', '그칠', '망'])
/* 훈(…할·…을)을 이름에서 담는 말(…함·…음)로 — '강인할'→'강인함', '맑을'→'맑음', '고울'→'고움'. '옥돌'처럼 이름씨는 그대로 */
const nounOf = w => {
  w = String(w || '').trim(); if (!w) return ''
  const last = w.slice(-1), c = last.charCodeAt(0) - 0xAC00
  if (c < 0 || c > 11171) return w
  if (last === '을' && w.length > 1) return w.slice(0, -1) + '음'
  if (c % 28 === 8 && w.length > 1) return w.slice(0, -1) + String.fromCharCode(0xAC00 + c - 8 + 16)
  return w
}
const badHun = hun => (hun || []).some(w => BADSUB.test(w) || BADWORD.has(w.trim()))
const FEM = new Set([...'娟婉姬娥姸娜媛嬉妍姝婷嫣嬌媚'])
const MAS = new Set([...'雄勇武剛彪虎猛豪將'])
const teaseList = TEASE.split(/\s+/).filter(Boolean)
const AVOIDSET = new Set([...AVOID])
const rank = (ko, sex) => { const i = TOP2025[sex].findIndex(([n]) => n === ko); return i < 0 ? null : { rank: i + 1, count: TOP2025[sex][i][1], total: TOP2025.전체[sex] } }

function sealsOf(c) {
  const s = []
  if (c.checks.every(x => x.score >= 7)) s.push('通')
  const snd = c.checks.find(x => x.key === '소리'); if (snd?.both) s.push('二說通')
  const sj = c.checks.find(x => x.key === '사주'); if (sj?.score >= 8) s.push('補')
  return s
}
const gradeOf = t => t >= 90 ? ['上上', '상상'] : t >= 80 ? ['上', '상'] : t >= 70 ? ['中上', '중상'] : t >= 60 ? ['中', '중'] : ['下', '하']

/**
 * 이름 하나를 열 잣대로 잰다.
 * n = { sur, surHj, given(한글), givenHj(한자), sex }, s = sajuOf(...)
 */
export function evaluate(n, s) {
  const surChars = [...n.surHj].map(h => BY.get(h) || { h, won: 0, el: '土', hun: [] })
  const sw = surChars.reduce((a, r) => a + r.won, 0)
  const gks = [...n.given], ghs = [...n.givenHj]
  const gs = ghs.map((h, i) => BY.get(h) || { h, won: 0, el: null, hun: [], eum: [], missing: true })
  const checks = []
  const roleOf = e => e === s.yong ? '용신' : e === s.hee ? '희신' : e === s.gi ? '기신' : (s.johu && e === s.johu) ? '조후' : '한신'
  const ROLE_TXT = { 용신: '이 사주에 가장 필요한 기운(용신)이라 빈자리를 바로 채웁니다', 희신: '가장 필요한 기운을 뒤에서 거들어 주는 기운(희신)입니다', 조후: '태어난 철의 춥고 더움을 맞춰 주는 기운입니다', 한신: '해도 득도 크지 않은 보통 기운입니다', 기신: '이 사주가 꺼리는 기운(기신)이라 오히려 짐이 됩니다' }

  // ① 사주 보완
  {
    const pts = { 용신: 5, 희신: 3.5, 조후: 3, 한신: 1.5, 기신: 0 }
    const roles = gs.map(g => g.el ? roleOf(g.el) : '한신')
    let sc = roles.reduce((a, r) => a + pts[r], 0) / gs.length * 2
    if (gs.length > 1 && roles.includes('용신') && (roles.includes('희신') || roles.filter(r => r === '용신').length > 1)) sc = Math.max(sc, 9.5)
    sc = Math.min(10, Math.round(sc * 10) / 10)
    const lines = gs.map((g, i) => `${g.h}(${gks[i]}) — 글자 뿌리가 ${g.el ? ELKO[g.el] + '(' + g.el + ')' : '알 수 없음'}입니다. ${g.el ? ROLE_TXT[roleOf(g.el)] + '.' : ''}`)
    lines.push(`글자 뿌리는 한자의 부수(뿌리 글자)로 정합니다. 이 사주는 ${J.이(ELKO[s.yong])} 가장 모자라고, ${ELKO[s.hee]} 기운이 그 뒤를 받칩니다.`)
    const verdict = sc >= 9 ? `사주에 모자란 ${ELKO[s.yong]} 기운을 이름이 정확히 채웁니다.` : sc >= 7 ? `사주를 돕는 기운이 들어 있습니다.` : sc >= 5 ? `사주에 크게 해롭지는 않으나 꼭 필요한 기운은 비어 있습니다.` : `이 사주가 꺼리는 기운이 이름에 들어 있습니다.`
    checks.push({ key: '사주', no: 1, title: '사주 보완', icon: 'plum', score: sc, verdict, lines })
  }
  // ② 글자 뿌리(자원오행 흐름)
  {
    const seq = [surChars[surChars.length - 1], ...gs].map(g => g.el)
    const pairs = []; for (let i = 0; i + 1 < seq.length; i++) pairs.push(seq[i] && seq[i + 1] ? rel(seq[i], seq[i + 1]) : 'same')
    const bad = pairs.filter(p => p === 'ctl').length, good = pairs.filter(p => p === 'gen' || p === 'genr').length
    const sc = bad === 0 ? (good === pairs.length ? 10 : good > 0 ? 8.5 : 7) : bad === 1 ? 4.5 : 1.5
    const names = [n.surHj.slice(-1), ...ghs]
    const lines = pairs.map((p, i) => `${names[i]}(${ELKO[seq[i]] || '?'}) → ${names[i + 1]}(${ELKO[seq[i + 1]] || '?'}): ${RELKO[p]}`)
    checks.push({ key: '뿌리', no: 2, title: '글자 뿌리', icon: 'roots', score: sc, flow: pairs, seq, verdict: bad ? `글자 뿌리끼리 부딪치는 곳이 ${bad}군데 있습니다.` : good ? '성에서 이름 끝 자까지 글자 뿌리가 막힘 없이 이어집니다.' : '글자 뿌리끼리 부딪치지는 않습니다.', lines })
  }
  // ③ 수리 사격
  const sg = sagyeok(sw, gs.map(g => g.won))
  {
    const gil = sg.filter(x => x.gil).length
    const sc = [1, 2.5, 4.5, 7, 10][gil]
    checks.push({ key: '수리', no: 3, title: '수리 사격', icon: 'rods', score: sc, sagyeok: sg, verdict: gil === 4 ? '획수로 보는 네 시기 운이 모두 좋은 수입니다.' : `획수로 보는 네 시기 가운데 ${4 - gil}곳이 좋지 않은 수입니다.`,
      lines: ['이름 글자의 획수를 더해 네 시기의 운을 봅니다(원형이정 사격). 수는 1부터 81까지 좋고 나쁨이 정해져 있습니다.', ...sg.map(x => `${SUPLAIN[x.k]} — ${x.ko} ${x.n}수, ${x.rd}(${x.nm}) ${x.gil ? '좋음' : '나쁨'}. ${x.t}`)] })
  }
  // ④ 음양
  {
    const all = [...surChars.map(r => r.won), ...gs.map(g => g.won)]
    const odd = all.filter(w => w % 2).length, even = all.length - odd
    const sc = odd && even ? 10 : 2
    checks.push({ key: '음양', no: 4, title: '음양', icon: 'sunmoon', score: sc, verdict: odd && even ? '홀수(양)와 짝수(음) 획이 섞여 음양이 어울립니다.' : `획수가 모두 ${odd ? '홀수(양)' : '짝수(음)'}라 한쪽으로 몰렸습니다.`, lines: ['획수가 홀수면 양, 짝수면 음으로 봅니다. 성과 이름 글자가 한쪽으로 몰리지 않아야 기운이 고릅니다.', ...[...surChars.map(r => r.h), ...ghs].map((h, i) => `${h} ${all[i]}획 — ${all[i] % 2 ? '양(홀수)' : '음(짝수)'}`)] })
  }
  // ⑤ 소리 오행 — 두 학설
  {
    const syl = [...n.sur.slice(-1), ...gks]
    const per = {}
    for (const sc of ['운해', '해례']) {
      const seq = syl.map(c => soundEl(c, sc)); const pairs = []
      for (let i = 0; i + 1 < seq.length; i++) pairs.push(rel(seq[i], seq[i + 1]))
      const bad = pairs.filter(p => p === 'ctl').length, good = pairs.filter(p => p !== 'same' && p !== 'ctl').length
      per[sc] = { seq, pairs, bad, score: bad === 0 ? (good ? 10 : 8) : bad === 1 ? 4 : 1 }
    }
    const both = per.운해.bad === 0 && per.해례.bad === 0
    const sc = Math.round((per.운해.score * 0.6 + per.해례.score * 0.4) * 10) / 10
    const show = k => syl.map((c, i) => `${c}(${ELKO[per[k].seq[i]]})`).join(' → ')
    checks.push({
      key: '소리', no: 5, title: '소리 오행', icon: 'bell', score: sc, both, per,
      verdict: both ? '두 학설 어느 쪽으로 들어도 소리가 서로 부딪치지 않습니다.' : per.운해.bad === 0 ? '요즘 작명가 다수가 쓰는 학설로는 부딪침이 없으나, 훈민정음 해례본 학설로는 한 곳이 부딪칩니다.' : per.해례.bad === 0 ? '훈민정음 해례본 학설로는 부딪침이 없으나, 요즘 다수 학설로는 부딪치는 곳이 있습니다.' : '두 학설 모두에서 소리가 부딪치는 곳이 있습니다.',
      lines: ['첫소리(자음)마다 기운이 있습니다. ㅇ·ㅎ을 어디에 두느냐로 보는 법이 둘로 갈려 둘 다 봤습니다.', `요즘 작명가 다수가 쓰는 법(ㅇ·ㅎ은 흙): ${show('운해')}`, `훈민정음 해례본을 따르는 법(ㅇ·ㅎ은 물): ${show('해례')}`],
    })
  }
  // ⑥ 부르는 맛
  {
    const full = n.sur + n.given, issues = []
    const syl = [...full]
    for (let i = 0; i + 1 < syl.length; i++) if (syl[i] === syl[i + 1]) issues.push(`'${syl[i]}' 소리가 잇달아 나옵니다`)
    if (gks.includes(n.sur.slice(-1))) issues.push('성과 같은 소리가 이름에 들어 있습니다')
    const chos = syl.map(c => plainCho(parts(c).cho)); if (chos.length >= 3 && new Set(chos).size === 1) issues.push(`첫소리가 모두 '${chos[0]}'이라 혀가 꼬이기 쉽습니다`)
    // 받침이 다음 'ㅇ'으로 넘어가며 나는 소리 — 그 소리로도 놀림말을 찾는다
    const heard = syl.map((c, i) => {
      let p0 = parts(c); const nx = syl[i + 1] && parts(syl[i + 1]); const pv = syl[i - 1] && parts(syl[i - 1])
      let cho = p0.cho, jong = p0.jong
      if (nx && jong && nx.cho === 'ㅇ' && CHO.includes(jong) && jong !== 'ㅇ') jong = ''
      if (pv && pv.jong && p0.cho === 'ㅇ' && CHO.includes(pv.jong) && pv.jong !== 'ㅇ') cho = pv.jong
      return String.fromCharCode(0xAC00 + CHO.indexOf(cho) * 588 + p0.jung * 28 + JONG.indexOf(jong))
    }).join('')
    const linkHit = heard !== full ? teaseList.filter(w => heard.includes(w) && !full.includes(w)) : []
    if (linkHit.length) issues.push(`[${heard}]로 소리 나 '${linkHit[0]}'처럼 들립니다`)
    const linkNote = heard !== full && !linkHit.length ? `${full}은 실제로 [${heard}]로 소리 납니다 — 다른 말로 들리지는 않습니다.` : null
    const sc = Math.max(3, 10 - issues.length * 2)
    checks.push({ key: '부름', no: 6, title: '부르는 맛', icon: 'wave', score: sc, verdict: issues.length ? `불러 볼 때 걸리는 곳이 ${issues.length}군데 있습니다.` : '소리가 매끄럽게 이어져 부르기 편합니다.', lines: issues.length ? [...issues, ...(linkNote ? [linkNote] : [])] : [linkNote || `${full} — 같은 소리가 겹치지 않고 소리 그대로 또렷하게 들립니다.`] })
  }
  // ⑦ 뜻
  {
    const pc = gs.map(g => g.missing ? 0 : POOLKEY.has(g.h) ? 10 : NAMEK[g.h] ? 9 : badHun(g.hun) ? 2 : 7)
    let sc = pc.reduce((a, b) => a + b, 0) / pc.length
    const notes = []
    if (n.sex === '남' && ghs.some(h => FEM.has(h))) { notes.push('여자 이름에 많이 쓰는 글자가 들어 있습니다'); sc -= 1 }
    if (n.sex === '여' && ghs.some(h => MAS.has(h))) { notes.push('남자 이름에 많이 쓰는 글자가 들어 있습니다'); sc -= 1 }
    sc = Math.max(0, Math.round(sc * 10) / 10)
    const ks = gs.map(g => POOLKEY.get(g.h) || NAMEK[g.h]?.[0] || nounOf(g.hun[0]))
    const join = ks.length === 2 && ks.every(Boolean) ? `‘${ks[0]}’에 ‘${ks[1]}’${batchim(ks[1]) ? '을' : '를'} 더한 이름입니다.` : ks.length === 1 && ks[0] ? `‘${ks[0]}’${batchim(ks[0]) ? '을' : '를'} 한 글자에 담은 이름입니다.` : ''
    // 바람 말 — 글자마다 '이런 사람이 되라'는 꾸밈말을 이어 이름 한 줄 풀이를 만든다(이름에 쓰는 글자만. 나머지는 뜻말로 대신)
    // 이름에 드문 글자가 섞이면 억지로 잇지 않는다 — 훈을 그대로 꿰면 '수레뒤턱나무의 뜻을 품은'처럼 어색해진다
    const bm = h => BARAM[h] || NAMEK[h]?.[1]
    const baram = gs.every(g => bm(g.h)) ? gs.map(g => bm(g.h)).join(', ') + ' 사람' : ''
    checks.push({ key: '뜻', no: 7, title: '뜻', icon: 'book', score: sc, keys: ks, join, baram, verdict: sc >= 9 ? '두 글자 모두 뜻이 맑고 이름에 오래 써 온 글자입니다.' : sc >= 6 ? '뜻에 흠은 없으나 이름에 흔히 쓰는 글자는 아닙니다.' : '이름에 쓰기에 뜻이 어두운 글자가 있습니다.', lines: [...gs.map((g, i) => `${g.h} — ${g.hun.length ? g.hun.map(w => w + ' ' + gks[i]).join(', ') : '뜻을 찾지 못했습니다'}${ks[i] && (POOLKEY.has(g.h) || NAMEK[g.h]) ? ` · 이름에서는 ‘${ks[i]}’${batchim(ks[i]) ? '을' : '를'} 담습니다` : ''}${!POOLKEY.has(g.h) && !NAMEK[g.h] && badHun(g.hun) ? ' (어두운 뜻이 섞여 있습니다)' : ''}`), ...(join ? [join] : []), ...(baram ? [`이어 읽으면 ‘${baram}’이 되라는 이름입니다.`] : []), ...notes] })
  }
  // ⑧ 인명용 한자
  {
    const ok = gs.map((g, i) => !g.missing && g.eum.includes(gks[i]))
    const sc = ok.every(Boolean) ? 10 : 0
    checks.push({ key: '인명', no: 8, title: '인명용 한자', icon: 'sieve', score: sc, verdict: sc ? '모든 글자가 대법원 인명용 한자 표에 그 음으로 올라 있어 출생신고·개명신고에 쓸 수 있습니다.' : '인명용 한자 표에 없는 글자가 있어 이대로는 신고할 수 없습니다.', lines: gs.map((g, i) => `${g.h} ${gks[i]} — ${ok[i] ? '인명용 한자 표에 있음' : g.missing ? '인명용 한자 표에 없음' : `표에는 '${g.eum.join(', ')}' 음으로만 있음`}`) })
  }
  // ⑨ 흔한 정도
  {
    const r = rank(n.given, n.sex)
    const sc = !r ? 10 : r.rank <= 10 ? 7 : 8
    const kid = n.by == null || n.by >= 2020
    checks.push({ key: '흔함', no: 9, title: '흔한 정도', icon: 'tags', score: sc, rank: r,
      verdict: r ? `2025년에 태어난 ${n.sex === '남' ? '남자' : '여자'} 아기 이름 ${r.rank}위입니다.` : '2025년에 태어난 아기 이름 상위 스물 안에 들지 않습니다.',
      lines: r ? [`한 해 ${r.count.toLocaleString('ko-KR')}명이 이 이름으로 신고됐습니다. 같은 해 ${n.sex === '남' ? '남자' : '여자'} 아기 ${Math.round(r.total / r.count)}명 가운데 1명꼴입니다.`, kid ? '같은 반에 같은 이름이 있을 수 있는 정도입니다.' : '요즘 아이들 사이에서 많이 불리는 소리라 젊은 이름으로 들립니다.']
        : [kid ? '같은 반에서 이름이 겹칠 일이 드문 소리입니다. 한자까지 같은 이름은 훨씬 드뭅니다.' : '요즘 태어나는 아이들 이름과 자주 겹치지 않는 소리입니다. 이 순위는 2025년 출생신고로만 본 것입니다.'] })
  }
  // ⑩ 놀림·피하는 글자
  {
    const full = n.sur + n.given
    const hit = teaseList.filter(w => full.includes(w) || n.given.includes(w))
    const av = ghs.filter(h => AVOIDSET.has(h))
    const sc = hit.length && av.length ? 1 : hit.length ? 2 : av.length ? 6 : 10
    const lines = []
    if (hit.length) lines.push(`'${hit[0]}'(으)로 들려 놀림을 받을 수 있습니다.`)
    if (av.length) lines.push(`${av.join('·')} — 옛 작명서가 이름에 피하라던 글자(불용문자)입니다. 요즘은 꺼리지 않는 작명가도 많습니다.`)
    if (!lines.length) lines.push('놀림말로 들리는 소리도, 옛 작명서가 피하라던 글자도 없습니다.')
    checks.push({ key: '놀림', no: 10, title: '놀림·피하는 글자', icon: 'scale', score: sc, verdict: hit.length ? '놀림말로 들릴 수 있는 소리가 있습니다.' : av.length ? '옛 작명서가 피하라던 글자가 하나 있습니다.' : '놀릴 거리도, 피할 글자도 없습니다.', lines })
  }

  const total = Math.round(checks.reduce((a, c) => a + c.score * W[c.key] / 10, 0))
  const [g, gk] = gradeOf(total)
  const out = { sur: n.sur, surHj: n.surHj, given: n.given, givenHj: n.givenHj, full: n.sur + n.given, fullHj: n.surHj + n.givenHj, total, grade: g, gradeKo: gk, checks, sagyeok: sg, chars: gs.map((g2, i) => ({ h: g2.h, ko: gks[i], hun: g2.hun, won: g2.won, el: g2.el, k: POOLKEY.get(g2.h) || NAMEK[g2.h]?.[0] || nounOf(g2.hun[0]) })), surWon: sw }
  out.seals = sealsOf(out)
  return out
}

/* ───────── 쉬운 풀이 ───────── */
const ELBEN = {
  木: '나무 기운은 곧게 자라는 힘입니다. 배우고 뻗어 나가는 일, 새로 시작하는 일, 사람을 키우는 일에 힘이 붙습니다.',
  火: '불 기운은 드러내는 힘입니다. 말과 표현, 사람 앞에 서는 일, 마음을 쏟는 일에 힘이 붙습니다.',
  土: '흙 기운은 버티고 품는 힘입니다. 믿음을 얻는 일, 오래 지키는 일, 재물을 모아 두는 일에 힘이 붙습니다.',
  金: '쇠 기운은 끊고 맺는 힘입니다. 결단과 마무리, 규칙을 세우는 일, 기술을 다루는 일에 힘이 붙습니다.',
  水: '물 기운은 흐르고 스미는 힘입니다. 지혜와 유연함, 사람 사이를 잇는 일, 공부와 생각에 힘이 붙습니다.',
}
const ELLACK = {
  木: '나무 기운이 비면 시작은 해도 꾸준히 뻗어 나가는 힘이 모자라기 쉽습니다.',
  火: '불 기운이 비면 속은 깊어도 자신을 드러내고 알리는 힘이 모자라기 쉽습니다.',
  土: '흙 기운이 비면 생각과 재주는 많아도 한곳에 붙어 지키고 모으는 힘이 모자라기 쉽습니다.',
  金: '쇠 기운이 비면 마음은 넉넉해도 딱 끊고 정리하는 힘이 모자라기 쉽습니다.',
  水: '물 기운이 비면 밀고 나가는 힘은 있어도 쉬어 가며 돌아보는 힘이 모자라기 쉽습니다.',
}
const ELOVER = {
  木: '나무 기운이 넘쳐 고집과 앞서가려는 마음이 세기 쉽습니다.',
  火: '불 기운이 넘쳐 마음이 급하고 금세 달아오르기 쉽습니다.',
  土: '흙 기운이 넘쳐 무겁고 느리며 한번 막히면 오래 묵히기 쉽습니다.',
  金: '쇠 기운이 넘쳐 날카롭고 남에게 엄격하기 쉽습니다.',
  水: '물 기운이 넘쳐 생각이 많고 마음이 흔들리기 쉽습니다.',
}
const STRONG_TXT = { 강: '그 바탕이 넘칠 만큼 굳센 사주입니다', 약: '그 바탕이 둘레 기운에 눌려 여린 사주입니다', 중: '바탕과 둘레 기운이 고르게 맞서는 사주입니다' }

/** 이름이 더해진 팔자 — 사주 여덟 글자의 다섯 기운에 이름 글자의 뿌리 기운을 더해 본다 */
export function palja(ev, s) {
  const before = { ...s.raw }, after = { ...s.raw }
  for (const c of ev.chars) if (c.el) after[c.el] += 1
  const lines = []
  for (const e of EL) {
    if (after[e] === before[e]) continue
    if (e === s.gi) lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 이 사주가 꺼리는 ${ELKO[e]} 기운을 이름이 보탭니다. 이 점은 아쉽습니다.`)
    else if (before[e] === 0) lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 사주에 한 글자도 없던 ${ELKO[e]} 자리를 이름이 채웁니다.`)
    else if (e === s.yong) lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 가장 필요한 ${ELKO[e]} 기운이 늘어 사주의 빈 곳을 메웁니다.`)
    else if (e === s.hee) lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 거드는 ${ELKO[e]} 기운이 늘어 필요한 기운을 받칩니다.`)
    else if (e === s.johu) lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 태어난 철의 춥고 더움을 맞춰 줍니다.`)
    else if (s.over.includes(e)) lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 이미 넉넉한 ${ELKO[e]} 기운을 이름이 더 보탭니다. 이 점은 아쉽습니다.`)
    else lines.push(`${ELKO[e]} 기운 ${before[e]} → ${after[e]}: 해도 득도 크지 않은 기운이라 판을 크게 바꾸지 않습니다.`)
  }
  const still = EL.filter(e => after[e] === 0)
  // 빈 기운 가운데 이 사주가 꺼리는 기운은 '채우라'고 하지 않는다 — 위에서 '피해서 고릅니다'라고 했다
  const fill = still.filter(e => e !== s.gi), keep = still.filter(e => e === s.gi)
  if (fill.length) lines.push(`이름을 더해도 ${fill.map(e => ELKO[e]).join('·')} 기운은 비어 있습니다. 이 기운은 생활에서 채우면 좋습니다(색·방향·하는 일).`)
  if (keep.length) lines.push(`${ELKO[keep[0]]} 기운은 비어 있지만 이 사주가 꺼리는 기운이라, 비워 두는 편이 낫습니다.`)
  if (!still.length) lines.push('이름을 더하면 다섯 기운이 하나도 비지 않습니다.')
  return { before, after, lines }
}

/** 이름 한눈 풀이 — 어려운 말 없이 대여섯 마디로 */
export function story(ev, s) {
  const P = []
  const ck = Object.fromEntries(ev.checks.map(c => [c.key, c]))
  const ch = ev.chars
  const meanOne = c => c.k ? `‘${c.k}’` : c.hun[0] ? `‘${c.hun[0]}’` : '뜻을 알 수 없는 글자'
  // 글자마다 훈을 줄이지 않고 다 적는다(밝을 철·쌍길 철) — 손님이 고른 한자를 그대로 알아보게
  const full1 = c => c.hun.length ? c.hun.map(w => `${w} ${c.ko}`).join('·') : c.ko
  const nun = c => `${c.h}(${full1(c)})${batchim(c.ko) ? '은' : '는'}`
  const eun = c => `${c.h}${batchim(c.ko) ? '은' : '는'}`
  const body = ch.map(c => `${eun(c)} ${c.won}획에 ${ELKO[c.el]} 기운`).join(', ')
  const bline = ck.뜻.baram ? ` ${ch.length > 1 ? '이어 읽으면' : '한 글자로'} ‘${ck.뜻.baram}’이 되라는 이름입니다.` : ''
  // '…더한 이름입니다. 이어 읽으면 …이름입니다'로 같은 끝이 겹치지 않게, 바람 말이 있으면 '…를 더해,'로 잇는다
  const j2 = ch.length === 2 && ck.뜻.baram ? `‘${ch[0].k}’에 ‘${ch[1].k}’${batchim(ch[1].k) ? '을' : '를'} 더해,${bline.replace(/^ /, ' ')}` : `${ck.뜻.join || ''}${bline}`
  if (ch.length === 2) P.push(`${ev.full}(${ev.fullHj}) — ${nun(ch[0])} ${meanOne(ch[0])}, ${nun(ch[1])} ${meanOne(ch[1])}${batchim((ch[1].k || ch[1].hun[0] || '')) ? '을' : '를'} 뜻합니다. ${j2} 글자의 몸으로 보면 ${body}을 품었습니다.`)
  else P.push(`${ev.full}(${ev.fullHj}) — ${ch.map(c => `${nun(c)} ${meanOne(c)}`).join(', ')}${batchim((ch[ch.length - 1].k || ch[ch.length - 1].hun[0] || '')) ? '을' : '를'} 뜻합니다.${bline} 글자의 몸으로 보면 ${body}을 품었습니다.`)
  const yongIn = ch.filter(c => c.el === s.yong).length, heeIn = ch.filter(c => c.el === s.hee).length, giIn = ch.filter(c => c.el === s.gi).length
  P.push(`태어난 날로 본 바탕은 ‘${s.dmTxt} ${ELKO[s.dm]}’이고, ${STRONG_TXT[s.strong]}. ${s.lack.length ? s.lack.map(e => e === s.gi ? `${ELKO[e]} 기운은 한 글자도 없지만, 이 사주가 꺼리는 기운이라 오히려 다행입니다.` : ELLACK[e]).join(' ') : s.over.length ? s.over.map(e => ELOVER[e]).join(' ') : '다섯 기운이 모두 들어 있어 크게 기운 곳은 없습니다.'}`)
  if (yongIn) P.push(`이름 ${yongIn === ch.length ? '글자 모두' : '한 글자'}가 이 사주에 가장 필요한 ${ELKO[s.yong]} 기운입니다. ${ELBEN[s.yong]} 이름을 부를 때마다 그 힘이 보태진다고 봅니다.`)
  else if (heeIn) P.push(`이름에 가장 필요한 ${ELKO[s.yong]} 기운은 없지만, 그것을 거드는 ${ELKO[s.hee]} 기운이 들어 있어 간접으로 돕습니다.`)
  else P.push(`이름 글자에 이 사주가 바라는 ${ELKO[s.yong]}·${ELKO[s.hee]} 기운이 없습니다. ${giIn ? `오히려 꺼리는 ${ELKO[s.gi]} 기운이 들어 있어 이름이 사주를 돕지 못합니다.` : '해롭지는 않으나 이름이 사주를 채워 주지는 못합니다.'}`)
  const g = ev.sagyeok, bad = g.filter(x => !x.gil)
  P.push(bad.length ? `획수로 보는 네 시기 가운데 ${bad.map(x => SUPLAIN[x.k]).join(', ')}의 수가 좋지 않습니다 — ${bad[0].t}. ${bad.length < 4 ? `나머지 ${['', '한', '두', '세'][4 - bad.length]} 시기는 좋은 수입니다.` : ''}` : `획수로 보는 네 시기 운이 모두 좋은 수입니다. 어린 시절에는 ‘${g[0].t}’, 평생 전체로는 ‘${g[3].t}’라는 수입니다.`)
  P.push(ck.소리.both ? '소리 기운은 두 가지 보는 법 모두에서 서로 부딪치지 않아 부르기에도 기운이 매끄럽습니다.' : ck.소리.per.운해.bad === 0 || ck.소리.per.해례.bad === 0 ? '소리 기운은 한 가지 보는 법에서만 부딪침이 있어, 크게 걱정할 정도는 아닙니다.' : '소리 기운이 두 가지 보는 법 모두에서 부딪칩니다. 부를 때 기운이 꺾이는 이름으로 봅니다.')
  const low = ev.checks.filter(c => c.score < 7).sort((a, b) => a.score - b.score)
  P.push(low.length ? `아쉬운 곳은 ${low.slice(0, 2).map(c => `‘${c.title}’`).reduce((a, b, i, arr) => i ? a + (batchim(arr[i - 1].slice(1, -1)) ? '과 ' : '와 ') + b : b, '')}입니다 — ${low[0].verdict}` : '열 가지 잣대 어디에서도 크게 깎인 곳이 없습니다.')
  // 총평은 점수 등급만이 아니라 사주 보완 점수도 본다 — '무난하다'면서 위에서 '사주를 돕지 못한다'고 하면 어긋난다
  const sj = ck.사주.score
  const tot = { 上上: '평생 불러도 좋을 이름입니다.',
    上: sj >= 6.5 ? '좋은 이름입니다. 큰 흠 없이 사주를 받쳐 줍니다.' : '소리·획수·뜻은 좋은 이름입니다. 다만 사주를 채우는 힘은 약합니다.',
    中上: sj < 4 ? '소리와 뜻은 무난하지만, 사주가 꺼리는 기운이 들어 있어 사주와는 맞지 않는 이름입니다.' : '무난한 이름입니다. 다만 사주를 돕는 힘은 크지 않습니다.', 中: '아쉬움이 많은 이름입니다. 고칠 곳이 분명합니다.', 下: '사주와 잘 맞지 않는 이름입니다. 바꾸는 쪽을 생각해 볼 만합니다.' }
  P.push(`총점 ${ev.total}점(${ev.gradeKo}) — ${tot[ev.grade]}`)
  return P
}

/* ───────── 이 이름을 고르면 좋은 점 · 지금 이름과 견주면 ─────────
   손님이 '잘 지었구나', '잘 바꿨구나' 하고 알아볼 수 있게, 점수표가 아니라 '무엇이 어떻게 좋아지나'를 말로 짚는다.
   좋은 점만 늘어놓지 않는다 — 새 이름이 못한 곳은 한 줄로 그대로 적는다 */
const ELSHORT = { 木: '꾸준히 뻗어 나가는 힘', 火: '자신을 드러내고 알리는 힘', 土: '믿음을 얻고 모아 지키는 힘', 金: '맺고 끊는 결단력', 水: '지혜와 사람을 잇는 힘' }
const AGE4 = { 元: '어린 시절', 亨: '젊은 날', 利: '한창때', 貞: '평생 전체' }
const ckOf = ev => Object.fromEntries(ev.checks.map(c => [c.key, c]))
const elCount = (ev, e) => ev.chars.filter(c => c.el === e).length
const elList = ev => ev.chars.map(c => `${c.h}(${ELKO[c.el]})`).join('·')
const howMany = (n, all) => n === all && all > 1 ? '두 글자 모두에' : '한 글자에'
const joinKeys = ks => ks.length === 2 ? `‘${ks[0]}’${batchim(ks[0]) ? '과' : '와'} ‘${ks[1]}’` : ks.map(k => `‘${k}’`).join(', ')
const sndLine = ck => { const p = ck.소리.per.운해; return p.seq.map(e => ELKO[e]).join(' → ') }

/** 아기 이름·새 이름 — 이 이름을 고르면 좋은 점. list 는 함께 지은 스무 이름(견줘서 '가장'을 짚는다) */
export function meritOf(x, s, list = [], o = {}) {
  const ck = ckOf(x), P = []
  const all = x.chars.length
  // ① 사주
  const ny = elCount(x, s.yong), nh = elCount(x, s.hee), ng = elCount(x, s.gi)
  if (ny) P.push({ t: `${ELKO[s.yong]} 기운을 채우는 이름`, d: s.raw[s.yong] === 0 ? `사주 ${s.hourKnown ? '여덟' : '여섯'} 글자에 한 글자도 없던 ${ELKO[s.yong]} 기운을 이름 ${howMany(ny, all)} 담았습니다. 비어 있던 자리를 이름이 메워 ${ELSHORT[s.yong]}이 붙습니다.` : `이 사주에 가장 모자란 ${ELKO[s.yong]} 기운을 이름 ${howMany(ny, all)} 담았습니다. 사주에 ${s.raw[s.yong]}개뿐이던 ${ELKO[s.yong]} 기운이 이름을 더하면 ${s.raw[s.yong] + ny}개가 됩니다 — ${ELSHORT[s.yong]}이 붙습니다.` })
  else if (nh && !ng) P.push({ t: `${ELKO[s.hee]} 기운으로 받치는 이름`, d: `가장 필요한 ${ELKO[s.yong]} 기운을 뒤에서 거드는 ${ELKO[s.hee]} 기운을 담아, 사주가 한쪽으로 기울지 않게 받칩니다.` })
  // ② 네 시기
  const g = x.sagyeok
  if (g.every(v => v.gil)) P.push({ t: '네 시기가 모두 좋은 수', d: `${g.map(v => `${AGE4[v.k]} ${v.n}수 ${v.rd}`).join(', ')} — 획수로 보는 네 시기 운이 하나도 빠짐없이 좋은 수입니다. 평생 전체로는 ‘${g[3].t}’라는 수입니다.` })
  // ③ 소리
  if (ck.소리.both) P.push({ t: '부를수록 매끄러운 소리', d: `${x.sur.slice(-1)}·${[...x.given].join('·')} 첫소리 기운이 ${sndLine(ck)}로 이어져, 요즘 작명가가 많이 쓰는 법과 훈민정음 해례본 어느 쪽으로 들어도 서로 부딪치지 않습니다.` })
  // ④ 뜻
  if (ck.뜻.baram) P.push({ t: '이름에 담은 바람', d: `${joinKeys(ck.뜻.keys)}${batchim(ck.뜻.keys[ck.뜻.keys.length - 1]) ? '을' : '를'} 담아, 이어 읽으면 ‘${ck.뜻.baram}’이 되라는 이름입니다.` })
  // ⑤ 고르신 뜻·돌림자
  const wishName = (o.wish || []).find(w => x.chars.some(c => WISH[w] && WISH[w].includes(c.h)))
  if (wishName) P.push({ t: `고르신 뜻 ‘${wishName === '큰뜻' ? '큰 뜻' : wishName}’`, d: `${x.chars.filter(c => WISH[wishName].includes(c.h)).map(c => c.h).join('·')} 글자가 고르신 뜻을 그대로 담습니다.` })
  if (o.dolKo) P.push({ t: '돌림자를 지킨 이름', d: `집안 돌림자 ${o.dolKo}(${o.dolHj})${batchim(o.dolKo) ? '을' : '를'} 그대로 두고, 남은 한 글자를 이 사주에 맞춰 골랐습니다.` })
  // ⑥ 흔함
  const r = ck.흔함.rank
  if (r && o.kind === 'baby') P.push({ t: '요즘 사랑받는 이름', d: `2025년에 태어난 ${o.sex === '여' ? '여자' : '남자'} 아기 이름 ${r.rank}위 — 많은 부모가 고른 만큼 부르기 익숙하고 정겹습니다. 한자까지 같은 이름은 훨씬 드뭅니다.` })
  else if (o.kind === 'baby') P.push({ t: '겹치지 않는 이름', d: '2025년 출생신고 상위 스물에 없는 이름이라, 같은 반에서 이름이 겹칠 일이 드뭅니다.' })
  // ⑦ 스무 이름 가운데
  if (list.length > 3) {
    const mx = Math.max(...list.map(v => v.total)), top = list.filter(v => v.total === mx).length
    const ms = Math.max(...list.map(v => ckOf(v).사주.score)), topS = list.filter(v => ckOf(v).사주.score === ms).length
    if (x.total === mx && top <= 3) P.push({ t: '스무 이름 가운데 으뜸', d: `함께 지은 스무 이름 가운데 총점이 가장 높은 이름입니다(${x.total}점).` })
    else if (ck.사주.score === ms && topS <= 5) P.push({ t: '사주를 가장 크게 채우는 쪽', d: '함께 지은 스무 이름 가운데 사주 보완 점수가 가장 높은 축에 듭니다.' })
  }
  // ⑧ 안심
  if (ck.인명.score === 10 && ck.놀림.score === 10) P.push({ t: '안심하고 쓰는 이름', d: '모든 글자가 출생신고·개명신고가 되는 대법원 인명용 한자이고, 놀림말로 들리는 소리도 옛 작명서가 피하라던 글자도 없습니다.' })
  const lead = `${J.을(x.full)} 고르면 좋은 점`
  return { lead, points: P.slice(0, 7) }
}

/** 지금 이름(a)과 새 이름(b)을 견준다 — 개명, 그리고 감정의 '같은 소리 더 나은 한자' */
export function compareNames(a, b, s, adult = true, sameSound = false) {
  const A = ckOf(a), B = ckOf(b), d = Math.round((b.total - a.total) * 10) / 10
  const P = []
  // 사주
  const ay = elCount(a, s.yong), ag = elCount(a, s.gi), by = elCount(b, s.yong), bh = elCount(b, s.hee), bg = elCount(b, s.gi)
  if (B.사주.score > A.사주.score) P.push({ w: (B.사주.score - A.사주.score) * 1.6 + 2, t: '사주를 채우는 힘',
    a: `${elList(a)} — ${ag ? `이 사주가 꺼리는 ${ELKO[s.gi]} 기운이 들어 있습니다` : ay ? `가장 필요한 ${ELKO[s.yong]} 기운이 한 글자뿐입니다` : `가장 필요한 ${ELKO[s.yong]} 기운이 없습니다`}`,
    b: `${elList(b)} — ${by || bh ? `${by ? `가장 필요한 ${ELKO[s.yong]} 기운을 ${howMany(by, b.chars.length)} 담아 ${ELSHORT[s.yong]}이 붙습니다` : `가장 필요한 기운을 거드는 ${ELKO[s.hee]} 기운을 담았습니다`}${!bg && ag ? `. 꺼리는 ${ELKO[s.gi]} 기운은 빠졌습니다` : ''}` : !bg && ag ? `이 사주가 꺼리는 ${ELKO[s.gi]} 기운이 빠졌습니다` : '사주와 덜 부딪치는 글자로 바꿨습니다'}`,
    n: `사주 보완 ${A.사주.score} → ${B.사주.score}` })
  // 네 시기
  const fixed = b.sagyeok.filter((v, i) => v.gil && !a.sagyeok[i].gil), broke = b.sagyeok.filter((v, i) => !v.gil && a.sagyeok[i].gil)
  if (fixed.length > broke.length) P.push({ w: (fixed.length - broke.length) * 2.5 + 1, t: '획수로 보는 네 시기 운',
    a: fixed.map(v => { const o = a.sagyeok.find(x => x.k === v.k); return `${AGE4[v.k]} ${o.n}수 ${o.rd} — ‘${o.t}’` }).join(' / '),
    b: fixed.map(v => `${AGE4[v.k]} ${v.n}수 ${v.rd} — ‘${v.t}’`).join(' / ') + (b.sagyeok.every(v => v.gil) ? '. 네 시기가 모두 좋은 수가 됩니다' : broke.length ? `. 대신 ${broke.map(v => `${AGE4[v.k]} ${v.n}수 ${v.rd}`).join('·')}${batchim(broke[broke.length - 1].rd) ? '은' : '는'} 나쁜 수가 됩니다` : ''),
    n: `나쁜 수 ${a.sagyeok.filter(v => !v.gil).length}곳 → ${b.sagyeok.filter(v => !v.gil).length}곳` })
  // 소리
  if (B.소리.score > A.소리.score + 0.5) P.push({ w: (B.소리.score - A.소리.score) + 1, t: '부르는 소리의 기운',
    a: `${sndLine(A)} — ${A.소리.verdict}`, b: `${sndLine(B)} — ${B.소리.verdict}`, n: `소리 오행 ${A.소리.score} → ${B.소리.score}` })
  // 글자 뿌리
  if (B.뿌리.score > A.뿌리.score + 0.5 && A.뿌리.verdict !== B.뿌리.verdict) P.push({ w: (B.뿌리.score - A.뿌리.score) * 0.8, t: '글자 뿌리의 흐름', a: A.뿌리.verdict, b: B.뿌리.verdict, n: `글자 뿌리 ${A.뿌리.score} → ${B.뿌리.score}` })
  // 음양·부름·놀림
  if (B.음양.score > A.음양.score && A.음양.verdict !== B.음양.verdict) P.push({ w: (B.음양.score - A.음양.score) * 0.6, t: '획수의 음양', a: A.음양.verdict, b: B.음양.verdict, n: `음양 ${A.음양.score} → ${B.음양.score}` })
  if (B.부름.score > A.부름.score && A.부름.verdict !== B.부름.verdict) P.push({ w: (B.부름.score - A.부름.score) * 0.6, t: '부르는 맛', a: A.부름.verdict, b: B.부름.verdict, n: `부르는 맛 ${A.부름.score} → ${B.부름.score}` })
  if (B.놀림.score > A.놀림.score) P.push({ w: (B.놀림.score - A.놀림.score) * 0.8, t: '놀림·피하는 글자', a: A.놀림.lines[0], b: '놀림말로 들리는 소리도, 피하라던 글자도 없습니다', n: `놀림 ${A.놀림.score} → ${B.놀림.score}` })
  if (!adult && B.흔함.score > A.흔함.score) P.push({ w: 0.5, t: '흔한 정도', a: A.흔함.verdict, b: B.흔함.verdict, n: '' })
  P.sort((x, y) => y.w - x.w)
  // 뜻 — 두 이름이 담은 바람
  const ab = A.뜻.baram, bb = B.뜻.baram
  const mean = bb ? { t: '이름에 담은 뜻', a: ab ? `‘${ab}’` : `‘${A.뜻.keys.join('’·‘')}’`, b: `‘${bb}’이 되라는 이름` } : null
  // 못한 곳 — 숨기지 않는다
  const wc = b.checks.filter(c => c.score < A[c.key].score - 0.5 && !(adult && c.key === '흔함'))
  const same = b.checks.filter(c => c.score === 10 && A[c.key].score === 10 && ['인명', '놀림', '음양', '부름'].includes(c.key)).map(c => c.title)
  const up = J.으로(b.gradeKo)
  const lead = sameSound ? `같은 ‘${a.given}’ 소리 그대로, 한자만 바꾸면 ${a.total}점 → ${b.total}점${d > 0 ? `. ${d}점이 오릅니다` : ''}${a.grade !== b.grade ? ` — 등급이 ${a.gradeKo}에서 ${up} 달라집니다` : ''}.`
    : d >= 15 ? `${a.total}점 → ${b.total}점. ${d}점이 오르고 등급이 ${a.gradeKo}에서 ${up} 올라갑니다. 바꿀 까닭이 분명한 이름입니다.`
    : d >= 5 ? `${a.total}점 → ${b.total}점. ${d}점이 오릅니다${a.grade !== b.grade ? ` — 등급도 ${a.gradeKo}에서 ${up}` : ''}. 지금 이름에서 아쉬웠던 곳을 메운 이름입니다.`
    : d > 0 ? `${a.total}점 → ${b.total}점. 점수 차는 크지 않지만, 아래 자리에서 지금 이름보다 앞섭니다.`
    : `점수는 지금 이름이 ${a.total}점으로 ${-d || ''}${d ? '점 높습니다' : '같습니다'}. 새 이름은 아래 자리에서만 앞섭니다.`
  return { lead, d, from: { full: a.full, fullHj: a.fullHj, total: a.total, gradeKo: a.gradeKo }, points: P.slice(0, 5).map(({ w, ...x }) => x), mean,
    worse: wc.length ? `다만 ${wc.map(c => `‘${c.title}’`).join('·')}${batchim(wc[wc.length - 1].title) ? '은' : '는'} 지금 이름이 앞섭니다(${wc.map(c => `${A[c.key].score}\u00a0→\u00a0${c.score}점`).join(', ')}).` : '',
    same: same.length ? `${same.join('·')}${batchim(same[same.length - 1]) ? '은' : '는'} 지금 이름처럼 흠이 없습니다.` : '',
    rows: b.checks.map(c => ({ title: c.title, a: A[c.key].score, b: c.score })) }
}

/** 지금 이름을 바꾼다면 어느 쪽으로 — 감정·개명에서 보여 준다 */
export function renameGuide(o, s, ev) {
  const surWon = [...o.surHj].reduce((a, h) => a + (BY.get(h)?.won || 0), 0)
  const low = ev.checks.filter(c => c.score < 7).sort((a, b) => a.score - b.score)
  // 총평과 어긋나지 않게 세 갈래 — 80점 아래이거나 사주·사격에 흠이 크면 바꾸기를 권하고,
  // 80점대는 '좋은 이름이지만 채울 곳이 있다', 90점 넘으면 '충분하다'
  const should = ev.total < 80 || ev.checks[0].score < 6.5 || ev.checks[2].score < 7
  const worth = !should && ev.total < 90
  const lowTxt = low.length ? low.slice(0, 3).map(c => `‘${c.title}’`).join('·') : ''
  const verdict = should
    ? `바꾸는 쪽을 권합니다. ${lowTxt ? lowTxt + '에서 깎였습니다.' : '사주를 돕는 힘이 약합니다.'}`
    : worth
      ? `지금 이름도 좋은 이름입니다. 다만 ${lowTxt ? lowTxt + '에서 점수가 덜 나와' : '아직 채울 곳이 있어'}, 바꾸신다면 아래 방향을 따르면 사주에 더 꼭 맞는 이름이 됩니다.`
      : `지금 이름으로도 충분합니다. 그래도 바꾸신다면 아래 방향을 따르면 지금보다 사주에 더 맞는 이름이 됩니다.`
  const need = [s.yong, s.hee].map(e => ({ el: e, ko: ELKO[e], ex: Object.values(POOLMAP).flat().filter(x => BY.get(x.h)?.el === e).slice(0, 40).filter((x, i, a) => a.findIndex(y => y.h === x.h) === i).slice(0, 8).map(x => ({ h: x.h, k: x.k, eum: BY.get(x.h).eum[0] })) }))
  // 첫소리 — 성과 부딪치지 않는 무리(두 보는 법 모두)
  const GROUP = [['ㄱ·ㅋ', '가'], ['ㄴ·ㄷ·ㄹ·ㅌ', '나'], ['ㅁ·ㅂ·ㅍ', '마'], ['ㅅ·ㅈ·ㅊ', '사'], ['ㅇ·ㅎ', '아']]
  const sur1 = o.sur.slice(-1)
  const good = GROUP.filter(([, rep]) => ['운해', '해례'].every(sc => rel(soundEl(sur1, sc), soundEl(rep, sc)) !== 'ctl')).map(g => g[0])
  const badS = GROUP.filter(([g]) => !good.includes(g)).map(g => g[0])
  // 획수 짝 — 네 격이 모두 길한 이름 두 글자 획수
  const pairs = []
  for (let a = 4; a <= 22; a++) for (let b = 4; b <= 22; b++) {
    const sg = sagyeok(surWon, [a, b]); const ws = [surWon, a, b]
    if (sg.every(x => x.gil) && !(ws.every(w => w % 2) || ws.every(w => !(w % 2)))) pairs.push([a, b])
  }
  const pick = pairs.filter((_, i) => i % Math.max(1, Math.floor(pairs.length / 6)) === 0).slice(0, 6)
  return {
    should, verdict,
    need, good, badS, pairs: pick, avoid: ELKO[s.gi],
    lines: [
      `이름 글자 뿌리에 ${ELKO[s.yong]}(${s.yong}) 기운을 첫째로, ${ELKO[s.hee]}(${s.hee}) 기운을 둘째로 담으십시오. ${ELKO[s.gi]}(${s.gi}) 기운 글자는 피하십시오.`,
      `이름 첫소리는 ${good.length ? good.join(' / ') + ' 쪽이' : '어느 쪽이든'} ${o.sur} 씨와 부딪치지 않습니다.${badS.length ? ` ${badS.join(' / ')} 쪽은 성과 소리가 부딪칩니다.` : ''}`,
      `성 ${o.surHj}(${surWon}획)에는 이름 두 글자를 ${pick.map(([a, b]) => `${a}획+${b}획`).join(', ')}처럼 맞추면 네 시기 운이 모두 좋은 수가 됩니다.`,
    ],
  }
}

/* ───────── 이름 짓기 ───────── */
const hash = s => crypto.createHash('sha256').update(s).digest().readUInt32BE(0)

/** 성·사주·돌림자·바라는 뜻으로 이름 후보를 모두 재고 순위를 낸다 */
export function generate(o, s) {
  const sex = o.sex
  let names = NAMES[sex].split(/\s+/).filter(Boolean)
  const seen = new Set()
  if (o.dolKo) {
    const p = o.dolPos - 1
    const others = new Set(names.map(nm => [...nm][1 - p]).filter(x => POOLMAP[x]))
    names = [...new Set([...names.filter(nm => [...nm][p] === o.dolKo), ...[...others].map(x => p === 0 ? o.dolKo + x : x + o.dolKo)])]
  }
  const listed = new Set(names)
  if (!o.dolKo && names.length) {
    const other = new Set(NAMES[sex === '남' ? '여' : '남'].split(/\s+/))
    const f = new Set(names.map(x => [...x][0])), b = new Set(names.map(x => [...x][1]))
    for (const a of f) for (const c of b) { const nm = a + c; if (a !== c && !listed.has(nm) && !other.has(nm) && !teaseList.some(w => nm.includes(w))) names.push(nm) }
  }
  const wish = new Set((o.wish || []).flatMap(w => [...WISH[w]]))
  const funnel = { 전체: HANJA_COUNT, 이름글자: 0, 수리: 0, 음양: 0, 소리: 0, 사주: 0, 남은이름: 0, 늦춤: 0 }
  const best = [], have = new Set()
  const surWon = [...o.surHj].reduce((a, h) => a + (BY.get(h)?.won || 0), 0)
  const lastSur = [...o.surHj].slice(-1)[0]
  const surEl = BY.get(lastSur)?.el
  /* 한 차례 거르기. R = 엄한 정도 — 엄한 차례로 스무 개가 안 차면(돌림자가 성과 소리가 부딪치는 집 등)
     소리는 점수로만 보고, 사격은 넷 중 셋, 사주는 해롭지 않으면 받는 둘째 차례로 채운다 */
  const run = (list, R) => {
    const seen = new Set()
    for (const nm of list) {
      if (seen.has(nm) || have.has(nm)) continue; seen.add(nm)
      const [s1, s2] = [...nm]
      if (s1 === s2) continue
      const A = o.dolKo && o.dolPos === 1 ? [{ h: o.dolHj }] : POOLMAP[s1] || []
      const B = o.dolKo && o.dolPos === 2 ? [{ h: o.dolHj }] : POOLMAP[s2] || []
      if (!A.length || !B.length) continue
      // 소리는 한자와 상관없다 — 이름마다 한 번만 본다. 두 학설 모두에서 부딪칠 때만 뺀다
      // (한 학설로만 걸리면 점수에서 덜고 까닭을 적는다 — 학설이 둘로 갈려 있어 한쪽만으로 버리면 지나치다)
      const badIn = sc => { const e = [o.sur.slice(-1), s1, s2].map(c => soundEl(c, sc)); return rel(e[0], e[1]) === 'ctl' || rel(e[1], e[2]) === 'ctl' }
      const sndBad = R.snd && badIn('운해') && badIn('해례')
      let top = null
      for (const a of A) for (const b of B) {
        if (a.h === b.h) continue
        const ra = BY.get(a.h), rb = BY.get(b.h); if (!ra || !rb) continue
        if ((sex === '남' && (FEM.has(a.h) || FEM.has(b.h))) || (sex === '여' && (MAS.has(a.h) || MAS.has(b.h)))) continue
        if (R.count) funnel.이름글자++
        const sg = sagyeok(surWon, [ra.won, rb.won]); if (sg.filter(x => x.gil).length < R.suri) continue
        if (R.count) funnel.수리++
        const ws = [surWon, ra.won, rb.won]; if (R.yy !== false && (ws.every(w => w % 2) || ws.every(w => !(w % 2)))) continue
        if (R.count) funnel.음양++
        if (sndBad) continue
        if (R.count) funnel.소리++
        const good = e => e === s.yong || e === s.hee || e === s.johu
        if (R.el !== 'free') { if ([ra.el, rb.el].includes(s.gi) || ![ra.el, rb.el].some(good)) continue }
        else {
          // 늦춘 차례: 돌림자는 집안이 정한 글자라 기운을 따지지 않고, 나머지 한 자만 본다(꺼리는 기운은 끝까지 뺀다)
          const fr = o.dolKo ? [o.dolPos === 1 ? rb : ra] : [ra, rb]
          if (fr.some(r => r.el === s.gi)) continue
          if (R.needGood && !fr.some(r => good(r.el))) continue
        }
        if (R.chain !== false && surEl && (rel(surEl, ra.el) === 'ctl' && rel(ra.el, rb.el) === 'ctl')) continue
        if (R.count) funnel.사주++
        const ev = evaluate({ sur: o.sur, surHj: o.surHj, given: nm, givenHj: a.h + b.h, sex, by: o.y }, s)
        if (ev.checks.find(c => c.key === '놀림').score < 6 || ev.checks[0].score < R.saju) continue
        const bonus = [a.h, b.h].filter(h => wish.has(h)).length * 3
        const key = ev.total + bonus - (listed.has(nm) ? 0 : 15) - (R.count ? 0 : 30) + (hash(o.sur + nm + a.h + b.h + o.y + o.m + o.d) % 100) / 1000
        if (!top || key > top.key) top = { key, ev, wishHit: bonus > 0, listed: listed.has(nm), relaxed: !R.count }
      }
      if (top) { best.push(top); have.add(nm) }
    }
  }
  // 돌림자면 다른 자리에 이름 소리 전부를 넣어 본다 — 엄한 차례부터 넓게 찾아야 늦춘 이름이 덜 섞인다
  let more = names
  if (o.dolKo) {
    const p = o.dolPos - 1, all = Object.keys(POOLMAP)
    more = [...names, ...all.map(x => p === 0 ? o.dolKo + x : x + o.dolKo).filter(nm => !teaseList.some(w => nm.includes(w)))]
  }
  // 돌림자는 집안이 정한 글자 — 엄한 차례에서도 그 자리의 기운은 따지지 않고, 다른 한 자가 사주를 채우는지를 본다
  run(more, { snd: true, suri: 4, saju: o.dolKo ? 5 : 6.5, count: true, ...(o.dolKo ? { el: 'free', needGood: true } : {}) })
  funnel.남은이름 = best.length
  if (o.dolKo) funnel.돌림 = `${o.dolKo}(${o.dolHj})`
  if (best.length < 20) {
    run(more, { snd: false, suri: 3, saju: 5, count: false })
    /* 돌림자가 이 사주가 꺼리는 기운이거나 성과 획수가 맞지 않으면 위 두 차례로도 0개가 나왔다(400건 중 91건).
       값을 받고 스무 개를 드리기로 했으니 — 돌림자 자리는 기운을 따지지 않고 나머지 한 자로 사주를 채우는 차례,
       그래도 모자라면 사격·음양을 점수로만 보는 차례로 채운다. 늦춘 만큼 점수가 낮게 나오고, 화면에 까닭을 적는다 */
    if (best.length < 20) run(more, { snd: false, suri: 2, saju: 3, count: false, el: 'free', needGood: true, yy: false })
    if (best.length < 20) run(more, { snd: false, suri: 0, saju: 0, count: false, el: 'free', needGood: false, yy: false, chain: false })
    funnel.늦춤 = best.length - funnel.남은이름
  }
  best.sort((a, b) => b.key - a.key)
  /* 한 소리로 쏠리지 않게 — 열 개 한 장 안에서 같은 소리(앞·뒤 어느 자리든)는 셋까지. 돌림자는 세지 않는다.
     '준'이 준수·준호·해준·원준·호준…처럼 열에 여섯 번 나오던 것 */
  const sylOf = x => [...x.ev.given].filter(c => c !== o.dolKo)
  const page = (pool, cap) => {
    const got = [], cnt = {}, left = []
    for (const x of pool) {
      if (got.length < 10 && sylOf(x).every(c => (cnt[c] || 0) < cap)) { got.push(x); for (const c of sylOf(x)) cnt[c] = (cnt[c] || 0) + 1 }
      else left.push(x)
    }
    // 셋 제한으로 열이 안 차면(이름 수가 적은 사주) 남은 것에서 점수 순으로 채운다
    while (got.length < 10 && left.length) got.push(left.shift())
    return [got, left]
  }
  const [p1, r1] = page(best, 3), [p2] = page(r1, 3)
  // 보여 줄 때는 열 개씩 점수 순으로 — 바라는 뜻과 소리 고르기는 '어느 이름이 열 안에 드나'에만 쓴다
  const byTotal = (a, b) => b.ev.total - a.ev.total || b.key - a.key
  const list = [...p1.sort(byTotal), ...p2.sort(byTotal)].slice(0, 20).map((x, i) => ({ ...x.ev, rank: i + 1, wishHit: x.wishHit, listed: x.listed, relaxed: x.relaxed }))
  return { list, funnel }
}

/** 감정한 이름과 소리가 같은 더 좋은 한자 셋 */
function betterHanja(o, s, cur) {
  const gk = [...o.given]
  const opts = gk.map(c => (POOLMAP[c] || []).map(x => x.h))
  if (opts.some(x => !x.length) || gk.length !== 2) return []
  const out = []
  for (const a of opts[0]) for (const b of opts[1]) {
    if (a + b === o.givenHj || a === b) continue
    const ev = evaluate({ sur: o.sur, surHj: o.surHj, given: o.given, givenHj: a + b, sex: o.sex, by: o.y }, s)
    if (ev.total > cur.total) out.push(ev)
  }
  return out.sort((x, y) => y.total - x.total).slice(0, 3)
}

/* ───────── 보여 줄 것 ───────── */
const FREE_KEYS = ['인명', '음양', '흔함']
const sealCheck = c => ({ key: c.key, no: c.no, title: c.title, icon: c.icon, sealed: true })
function sajuView(s) { return { ...s, lines: sajuText(s), elko: ELKO } }

/** 무료로 보여 주는 것 — 결제 전 서버가 내보내는 전부 */
export function freeView(o) {
  const s = sajuOf(birthOf(o)); if (!s) { const e = new Error('BAD_BIRTH'); e.code = 'BAD_BIRTH'; throw e }
  if (o.kind === 'manse') return { kind: 'manse', saju: sajuView(s) }
  if (o.kind === 'gamjeong') {
    const ev = evaluate({ sur: o.sur, surHj: o.surHj, given: o.given, givenHj: o.givenHj, sex: o.sex, by: o.y }, s)
    return { kind: o.kind, saju: { cols: s.cols, hourKnown: s.hourKnown, solar: s.solar, cnt: s.cnt, raw: s.raw, dmHj: s.dmHj, dm: s.dm, elko: ELKO }, name: { full: ev.full, fullHj: ev.fullHj, chars: ev.chars },
      checks: ev.checks.map(c => FREE_KEYS.includes(c.key) ? c : sealCheck(c)), sealedCount: ev.checks.filter(c => !FREE_KEYS.includes(c.key)).length }
  }
  const g = generate(o, s)
  const cur = o.kind === 'rename' && o.given ? evaluate({ sur: o.sur, surHj: o.surHj, given: o.given, givenHj: o.givenHj, sex: o.sex, by: o.y }, s) : null
  return {
    kind: o.kind, saju: sajuView(s), funnel: g.funnel, count: g.list.length,
    sealed: g.list.slice(0, 10).map(x => ({ total: x.total, grade: x.grade, seals: x.seals })),
    current: cur ? { full: cur.full, fullHj: cur.fullHj, grade: cur.grade, gradeKo: cur.gradeKo } : null,
  }
}
/** 결제하면 보여 주는 것 */
export function fullView(o) {
  const s = sajuOf(birthOf(o)); if (!s) { const e = new Error('BAD_BIRTH'); e.code = 'BAD_BIRTH'; throw e }
  if (o.kind === 'gamjeong') {
    const ev = evaluate({ sur: o.sur, surHj: o.surHj, given: o.given, givenHj: o.givenHj, sex: o.sex, by: o.y }, s)
    const guide = renameGuide(o, s, ev)
    // 개명 견본 — 같은 사람을 개명으로 지으면 나오는 첫 셋(한자는 감추고 소리와 점수만)
    const g = generate({ ...o, kind: 'rename', given: undefined, givenHj: undefined, wish: [] }, s)
    guide.samples = g.list.slice(0, 3).map(x => ({ full: x.full, total: x.total, grade: x.grade }))
    const adult = o.y < new Date().getFullYear() - 19
    return { kind: o.kind, saju: sajuView(s), name: { ...ev, story: story(ev, s), palja: palja(ev, s) }, better: betterHanja(o, s, ev).map(x => ({ ...x, story: story(x, s), palja: palja(x, s), vs: compareNames(ev, x, s, adult, true) })), guide }
  }
  const g = generate(o, s)
  const cur = o.kind === 'rename' && o.given ? evaluate({ sur: o.sur, surHj: o.surHj, given: o.given, givenHj: o.givenHj, sex: o.sex, by: o.y }, s) : null
  const deco = x => ({ ...x, story: story(x, s), palja: palja(x, s) })
  // 지금 이름을 넣었으면 '지금 이름과 견주면', 아니면 '이 이름을 고르면 좋은 점'
  const adult = o.y < new Date().getFullYear() - 19
  const more = x => cur ? { vs: compareNames(cur, x, s, adult) } : { merit: meritOf(x, s, g.list, o) }
  return { kind: o.kind, saju: sajuView(s), funnel: g.funnel, list: g.list.map(x => ({ ...deco(x), ...more(x) })), current: cur ? { ...deco(cur), guide: renameGuide(o, s, cur) } : null }
}
export const PRODUCTS = ['baby', 'rename', 'gamjeong']
