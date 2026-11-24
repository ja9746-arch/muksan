// 엔진 시험 — 글자 표가 작명서 값과 맞는지, 지은 이름이 모두 잣대를 넘는지.
import fs from 'node:fs'
import { fullView, freeView, cleanInput, sagyeok, J } from '../api/_engine/muksan.js'
let bad = 0
const ok = (c, msg) => { if (!c) { bad++; console.log('✗', msg) } else console.log('·', msg) }
const H = new Map(JSON.parse(fs.readFileSync(new URL('../api/_data/hanja.json', import.meta.url))).map(r => [r[0], r]))
ok(H.size > 9000, `인명용 한자 ${H.size}자`)
// 작명서·공개 작명 사이트에서 쓰는 원획 — 부수를 본래 꼴로 센다
const WON = { 明: 8, 洙: 10, 浩: 11, 炫: 9, 俊: 9, 瑞: 14, 泰: 10, 成: 7, 城: 10, 誠: 14, 王: 4, 玉: 5, 陳: 16, 鄭: 19, 芝: 10, 胃: 11, 願: 19, 遠: 17, 金: 8, 李: 7, 朴: 6, 崔: 11, 韓: 17, 權: 22, 五: 5, 九: 9, 有: 6, 育: 10, 道: 16, 潤: 16, 允: 4, 賢: 15, 宇: 6, 智: 12 }
const wrong = Object.entries(WON).filter(([h, w]) => H.get(h)?.[3] !== w)
ok(!wrong.length, `원획 ${Object.keys(WON).length}자 대조 — 어긋남 ${wrong.map(([h, w]) => h + H.get(h)?.[3] + '≠' + w).join(' ')}`)
const JW = { 明: '火', 洙: '水', 瑞: '金', 娟: '土', 序: '木', 書: '木', 恕: '火', 召: '水', 素: '木', 遠: '土', 甲: '木', 午: '火', 申: '金' }
const jw = Object.entries(JW).filter(([h, e]) => H.get(h)?.[4] !== e)
ok(!jw.length, `자원오행 ${Object.keys(JW).length}자 대조 — 어긋남 ${jw.map(([h]) => h).join(' ')}`)
// 사격 — 金(8) 道(13) 潤(16)
const sg = sagyeok(8, [13, 16])
ok(sg.map(x => x.n).join() === '29,21,24,37', `사격 원형이정 ${sg.map(x => x.n)}`)
ok(J.을('흙(土)') === '흙(土)을' && J.을('나무') === '나무를' && J.으로('물') === '물로' && J.으로('흙') === '흙으로', '조사가 받침을 따른다')

// 지은 이름 — 400벌
let a = 99; const R = n => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) % n }
const surs = [['김', '金'], ['이', '李'], ['박', '朴'], ['최', '崔'], ['정', '鄭'], ['강', '姜'], ['조', '趙'], ['윤', '尹'], ['장', '張'], ['임', '林'], ['한', '韓'], ['오', '吳'], ['서', '徐'], ['신', '申'], ['권', '權'], ['황', '黃'], ['남궁', '南宮'], ['제갈', '諸葛']]
let n = 0, short = 0, fails = []
for (let i = 0; i < 400; i++) {
  const [sur, hj] = surs[R(surs.length)]
  const o = cleanInput({ kind: R(3) ? 'baby' : 'rename', sex: R(2) ? '남' : '여', cal: ['양력', '음력'][R(2)], y: 1960 + R(67), m: 1 + R(12), d: 1 + R(28), h: R(4) ? R(24) : null, sur, surHj: hj })
  const F = fullView(o)
  if (F.list.length < 20) short++
  for (const x of F.list) {
    n++
    const c = Object.fromEntries(x.checks.map(k => [k.key, k.score]))
    if (c.수리 !== 10 || c.음양 !== 10 || c.인명 !== 10 || c.놀림 < 6 || x.given[0] === x.given[1] || c.사주 < 6.5) fails.push(`${x.fullHj}${x.full} ${JSON.stringify(c)}`)
  }
  const fv = freeView(o)
  if (JSON.stringify(fv).match(/"given"|"givenHj"/)) fails.push('무료에 이름이 샜다')
}
ok(!short, `400벌 모두 이름 스무 개 — 모자란 벌 ${short}`)
ok(!fails.length, `지은 이름 ${n}개 모두 사격 넷 길·음양 섞임·인명용·놀림 없음·사주 도움 ${fails.slice(0, 3).join(' / ')}`)

// 만세력 — 독립 달력 계산기(lunar_python)와 3,000벌 맞대 본 뒤 남긴 대표값. 한국만의 셈(30분 보정·서머타임·한국 음력)이 든 곳도 넣는다
import { sajuOf } from '../api/_engine/muksan.js'
const P4 = b => { const s = sajuOf(b); return s.cols.slice().reverse().map(c => c ? c.s + c.b : '--').join(' ') }
const MANSE = [
  [{ sex: '남', cal: '양력', y: 1991, m: 4, d: 23, h: 22 }, '辛未 壬辰 癸亥 癸亥', '1991-04-23 22시'],
  [{ sex: '남', cal: '양력', y: 2000, m: 1, d: 1, h: 12 }, '己卯 丙子 戊午 戊午', '2000-01-01 정오(戊午일)'],
  [{ sex: '남', cal: '양력', y: 1987, m: 7, d: 28, h: 2 }, '丁卯 丁未 戊寅 壬子', '1987 서머타임 — 새벽 2시가 자시(戊일 壬子시)'],
  [{ sex: '여', cal: '음력', y: 1995, m: 7, d: 2, h: 12 }, null, '한국 음력 1995-07-02 = 양력 1995-07-29'],
]
for (const [b, want, label] of MANSE) {
  if (want) ok(P4(b) === want, `만세력 ${label}: ${P4(b)}`)
  else { const s = sajuOf(b); ok(s.solar && s.solar.year === 1995 && s.solar.month === 7 && s.solar.day === 29, `${label}: ${s.solar && [s.solar.year, s.solar.month, s.solar.day].join('-')}`) }
}
console.log(bad ? `\n틀림 ${bad}` : '\n엔진 시험 모두 통과')
process.exit(bad ? 1 : 0)
