// 창구 시험 — 무료 → 주문 → 미리보기 승인 → 다시 열기, 그리고 운영 주소·대문 경유에서 닫히는지.
// 토스 열쇠가 없는 미리보기(데모) 길로 끝까지 가 본다. 쿠키는 손으로 넘긴다.
import name from '../api/name.js'
import order from '../api/order.js'
import { PRICE } from '../api/_lib/price.js'

delete process.env.TOSS_CLIENT_KEY; delete process.env.TOSS_SECRET_KEY; delete process.env.RECORD_SECRET; delete process.env.VERCEL_ENV
let jar = {}, host = 'muksan.vercel.app'
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
async function call(h, method, body, url = '/') {
  const req = { method, url, body, headers: { cookie: cookieHeader(), 'x-forwarded-proto': 'https', host }, query: {} }
  const out = { headers: {}, chunks: [] }
  const res = {
    statusCode: 200,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v }, getHeader(k) { return out.headers[k.toLowerCase()] },
    end(b) { out.code = this.statusCode; if (b) out.chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(String(b))) },
  }
  await h(req, res)
  for (const c of [].concat(out.headers['set-cookie'] || [])) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1) }
  const buf = Buffer.concat(out.chunks)
  return { code: out.code, json: (() => { try { return JSON.parse(buf.toString()) } catch { return null } })() }
}
let bad = 0
const ok = (c, msg) => { if (!c) { bad++; console.log('✗', msg) } else console.log('·', msg) }

const baby = { kind: 'baby', sex: '남', cal: '양력', y: 2026, m: 3, d: 14, h: 9, mi: 30, sur: '김', surHj: '金' }
const ren = { kind: 'rename', sex: '남', cal: '양력', y: 1991, m: 4, d: 23, h: 22, mi: 0, sur: '김', surHj: '金', given: '민철', givenHj: '敏哲' }
const gam = { kind: 'gamjeong', sex: '여', cal: '음력', y: 1995, m: 8, d: 2, h: null, sur: '이', surHj: '李', given: '서연', givenHj: '瑞姸' }

const s = await call(name, 'GET', null, '/api/name?sur=1')
ok(s.json?.ok && s.json.list.length > 100 && s.json.price.baby === PRICE.baby, '성씨 목록과 값')
const e = await call(name, 'GET', null, '/api/name?eum=' + encodeURIComponent('윤'))
ok(e.json?.ok && e.json.list[0].pool && e.json.list.some(x => x.h === '潤'), '소리로 한자 찾기 — 이름에 쓰는 글자가 먼저')

const f = await call(name, 'POST', { input: baby })
ok(f.json?.ok && f.json.view.sealed.length === 10 && f.json.view.funnel.남은이름 >= 10, `무료(아기 이름) — 봉한 이름 ${f.json?.view?.sealed?.length}`)
ok(!JSON.stringify(f.json.view).match(/"given"|"givenHj"|"fullHj"/), '무료에는 이름 글자가 한 자도 없다')
const fg = await call(name, 'POST', { input: gam })
const opened = fg.json?.view?.checks.filter(c => !c.sealed).map(c => c.key)
ok(fg.json?.ok && opened.join() === '음양,인명,흔함', `무료(감정) — 열린 잣대 ${opened}`)
ok(fg.json.view.checks.filter(c => c.sealed).every(c => !('score' in c) && !('lines' in c)), '봉한 잣대에는 점수·풀이가 없다')
ok(!('total' in fg.json.view) && !JSON.stringify(fg.json.view).includes('"grade"'), '무료 감정에는 총점·등급이 없다')
const fm = await call(name, 'POST', { input: { kind: 'manse', sex: '여', cal: '양력', y: 1991, m: 4, d: 23, h: 22 } })
ok(fm.json?.ok && fm.json.view.saju.cols[1].s === '癸' && fm.json.view.saju.cols[0].b === '亥', '만세력 — 1991-04-23 22시는 癸亥일 癸亥시')

const cfg = await call(order, 'GET', null, '/api/order')
ok(cfg.json?.mode === 'demo' && cfg.json.price.gamjeong === PRICE.gamjeong, `결제 방식 ${cfg.json?.mode}`)

for (const [inp, label] of [[baby, '아기 이름'], [gam, '이름 감정'], [ren, '개명']]) {
  const c = await call(order, 'POST', { action: 'create', input: inp, from: 'test' })
  ok(c.json?.ok && /^ms\d{8}/.test(c.json.orderId) && c.json.amount === PRICE[inp.kind], `${label} 주문 ${c.json?.orderId} ${c.json?.amount}`)
  const r0 = await call(order, 'POST', { action: 'restore', input: inp })
  ok(r0.json?.code === 'NOT_PAID', `${label} — 결제 전 다시 열기는 막힌다`)
  const b1 = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: c.json.amount, ticket: 'x'.repeat(32), input: inp })
  ok(!b1.json?.ok, `${label} — 틀린 표로는 승인 안 됨`)
  const other = { ...inp, d: inp.d + 1 }
  const b2 = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: c.json.amount, ticket: c.json.ticket, input: other })
  ok(!b2.json?.ok, `${label} — 다른 생일로 남의 표를 쓰면 안 됨`)
  const cf = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: c.json.amount, ticket: c.json.ticket, input: inp })
  ok(cf.json?.ok && (inp.kind !== 'gamjeong' ? cf.json.eng.list.length === 20 && cf.json.eng.list[0].checks.length === 10 : cf.json.eng.name.checks.every(x => !x.sealed && typeof x.score === 'number')), `${label} — 승인되면 풀이 전부가 온다`)
  const r1 = await call(order, 'POST', { action: 'restore', input: inp })
  ok(r1.json?.ok, `${label} — 새로 고침 뒤 다시 열린다`)
}
ok(!!jar.ms_paid, '결제 증표 쿠키가 심긴다')
// 감정 값으로 아기 이름을 열 수 없다(표에 금액이 묶여 있다)
{
  const c = await call(order, 'POST', { action: 'create', input: gam })
  const x = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: PRICE.gamjeong, ticket: c.json.ticket, input: { ...baby, d: 20 } })
  ok(!x.json?.ok, '4,900원 표로 19,900원 상품을 못 연다')
}
// 값 — 개명 29,900원, 아기 19,900원, 감정 4,900원. 아기 값 표로 개명을 못 연다
ok(PRICE.rename === 29900 && PRICE.baby === 19900 && PRICE.gamjeong === 4900 && PRICE.hanja === 14900, `값 상수 ${PRICE.gamjeong}·${PRICE.hanja}·${PRICE.baby}·${PRICE.rename}`)
// 한자만 바꾸기 — 지금 한자보다 나은 짝만, 소리는 그대로. 짝이 없으면 주문을 받지 않는다. 14,900원 표로 29,900원 개명을 못 연다
{
  const hj = { ...ren, kind: 'hanja', d: 25 }
  const f = await call(name, 'POST', { input: hj })
  ok(f.json?.ok && f.json.view.count > 0 && f.json.view.sealed.every(x => !x.givenHj && !x.chars), `한자만 바꾸기 무료 화면 — 짝 ${f.json?.view?.count}가지, 한자는 봉함`)
  const c = await call(order, 'POST', { action: 'create', input: hj })
  ok(c.json?.ok && c.json.amount === 14900, `한자만 바꾸기 주문 금액 ${c.json?.amount}`)
  const x = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: 14900, ticket: c.json.ticket, input: { ...ren, d: 25 } })
  ok(!x.json?.ok, '14,900원(한자) 표로 29,900원 개명을 못 연다')
  const y = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: 14900, ticket: c.json.ticket, input: hj })
  const L = y.json?.eng?.list || []
  ok(y.json?.ok && L.length > 0 && L.every(v => v.given === '민철' && v.total > y.json.eng.current.total && v.vs), `한자만 바꾸기 결과 — ${L.length}가지 모두 ‘민철’ 소리, 지금(${y.json?.eng?.current?.total}점)보다 높고 견줌이 붙음`)
  const none = { ...ren, kind: 'hanja', given: '끝순', givenHj: undefined, sex: '여', d: 26 }
  const z = await call(order, 'POST', { action: 'create', input: none })
  ok(!z.json?.ok && z.json?.code === 'NO_OPTION', '드릴 짝이 없는 소리(끝순)는 주문을 받지 않는다')
}
{
  const c = await call(order, 'POST', { action: 'create', input: { ...baby, d: 21 } })
  const x = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: PRICE.baby, ticket: c.json.ticket, input: { ...ren, d: 24 } })
  ok(!x.json?.ok, '19,900원(아기) 표로 29,900원 개명을 못 연다')
  const y = await call(order, 'POST', { action: 'confirm', orderId: c.json.orderId, paymentKey: 'demo_' + c.json.orderId, amount: 19900, ticket: c.json.ticket, input: { ...baby, d: 21 } })
  ok(y.json?.ok, '같은 표·같은 값이면 아기 이름은 열린다(위 거절이 값 때문임을 확인)')
}

// 운영 — 대문(100gwi.com)을 거쳐 오면 열쇠가 없을 때 닫힌다
{
  const keep = jar; jar = {}
  process.env.VERCEL_ENV = 'production'
  host = '100gwi.com'
  const g = await call(order, 'GET', null, '/api/order')
  ok(g.json?.mode === 'closed' && g.json.reason === 'NO_KEY', `대문 경유·열쇠 없음 → ${g.json?.mode}`)
  const c2 = await call(order, 'POST', { action: 'create', input: baby })
  ok(c2.json?.ok === false && c2.json.code === 'NO_KEY', '대문 경유·열쇠 없음 → 주문을 내주지 않는다')
  const g2 = await call(order, 'GET', null, '/api/order?pay=toss')
  ok(g2.json?.mode === 'closed' && !g2.json.clientKey, '대문 경유에서는 ?pay=toss 시험 키도 안 준다')
  const fr = await call(name, 'POST', { input: baby })
  ok(fr.json?.ok, '닫혀도 무료 풀이는 그대로')
  host = 'muksan.vercel.app'
  const g3 = await call(order, 'GET', null, '/api/order')
  ok(g3.json?.mode === 'demo', '데모 주소(대문을 거치지 않음)에서는 미리보기로 연다')
  delete process.env.VERCEL_ENV; jar = keep
}

// 잘못된 입력
const x1 = await call(name, 'POST', { input: { ...gam, givenHj: '瑞' } })
ok(x1.json?.code === 'BAD_INPUT', '한자 수가 이름과 다르면 받지 않는다')
const x2 = await call(name, 'POST', { input: { ...baby, sur: '뷁' } })
ok(x2.json?.code === 'BAD_INPUT', '없는 성은 받지 않는다')
const x3 = await call(name, 'POST', { input: { ...baby, m: 2, d: 30 } })
ok(x3.json?.ok === false, '없는 날짜는 받지 않는다')

console.log(bad ? `\n틀림 ${bad}` : '\n창구 시험 모두 통과')
process.exit(bad ? 1 : 0)
