// 토스 승인 길 시험 — 진짜 토스 대신 가짜 응답(fetch 바꿔치기)으로 끝까지 돌린다. 돈은 오가지 않는다.
// 열쇠를 넣은 운영과 같은 조건(열쇠 두 개, VERCEL_ENV=production, 대문 주소)으로 본다.
import order from '../api/order.js'
import { PRICE } from '../api/_lib/price.js'

process.env.TOSS_CLIENT_KEY = ' live_gck_가짜열쇠 '   // 사람이 붙여 넣은 빈칸까지 — trim 되는지
process.env.TOSS_SECRET_KEY = 'live_gsk_가짜열쇠'
process.env.VERCEL_ENV = 'production'
delete process.env.RECORD_SECRET
let jar = {}
const host = '100gwi.com'
async function call(method, body, url = '/') {
  const req = { method, url, body, headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), 'x-forwarded-proto': 'https', host, 'x-forwarded-host': host }, query: {} }
  const out = { headers: {}, chunks: [] }
  const res = { statusCode: 200, setHeader(k, v) { out.headers[k.toLowerCase()] = v }, getHeader(k) { return out.headers[k.toLowerCase()] }, end(b) { if (b) out.chunks.push(Buffer.from(String(b))) } }
  await order(req, res)
  for (const c of [].concat(out.headers['set-cookie'] || [])) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1) }
  try { return JSON.parse(Buffer.concat(out.chunks).toString()) } catch { return null }
}
let bad = 0
const ok = (c, m) => { if (!c) { bad++; console.log('✗', m) } else console.log('·', m) }

// 가짜 토스 — 받은 몸을 적어 두고, 시킨 대로 답한다
let toss = { mode: 'done' }, seen = []
globalThis.fetch = async (u, opt = {}) => {
  seen.push({ u: String(u), body: opt.body ? JSON.parse(opt.body) : null, auth: opt.headers?.Authorization })
  const J = (status, j) => ({ ok: status < 300, status, json: async () => j })
  if (String(u).includes('/v1/payments/confirm')) {
    const b = JSON.parse(opt.body)
    if (toss.mode === 'done') return J(200, { status: 'DONE', orderId: b.orderId, totalAmount: b.amount, paymentKey: b.paymentKey })
    if (toss.mode === 'fail') return J(400, { code: 'REJECT_CARD_COMPANY', message: '카드사에서 거절했습니다.' })
    if (toss.mode === 'again') return J(400, { code: 'ALREADY_PROCESSED_PAYMENT', message: '이미 처리된 결제' })
  }
  if (String(u).includes('/v1/payments/')) return J(200, { status: 'DONE', orderId: toss.orderId, totalAmount: toss.total })
  return J(404, {})
}

const ren = { kind: 'rename', sex: '남', cal: '양력', y: 1991, m: 4, d: 23, h: 22, mi: 0, sur: '김', surHj: '金', given: '민철', givenHj: '敏哲' }
const baby = { kind: 'baby', sex: '여', cal: '양력', y: 2026, m: 3, d: 14, h: 9, mi: 0, sur: '이', surHj: '李' }

const cfg = await call('GET', null, '/api/order')
ok(cfg.mode === 'toss' && cfg.live === true && cfg.clientKey === 'live_gck_가짜열쇠', `열쇠를 넣으면 대문 주소에서도 토스로 열린다(빈칸 지움) — ${cfg.mode}`)

for (const [inp, label, want] of [[ren, '개명 29,900원', 29900], [baby, '아기 이름 19,900원', 19900], [{ ...ren, kind: 'gamjeong' }, '감정 4,900원', 4900]]) {
  jar = {}; seen = []; toss = { mode: 'done' }
  const c = await call('POST', { action: 'create', input: inp })
  ok(c.ok && c.mode === 'toss' && c.amount === want && PRICE[inp.kind] === want, `${label} — 주문 금액 ${c.amount}`)
  const bad1 = await call('POST', { action: 'confirm', orderId: c.orderId, paymentKey: 'pk_1', amount: c.amount - 1000, ticket: c.ticket, input: inp })
  ok(!bad1.ok && bad1.code === 'AMOUNT_MISMATCH' && !seen.length, `${label} — 금액을 줄여 보내면 토스에 묻기 전에 막힘`)
  const dm = await call('POST', { action: 'confirm', orderId: c.orderId, paymentKey: 'demo_' + c.orderId, amount: c.amount, ticket: c.ticket, input: inp })
  ok(!dm.ok, `${label} — 열쇠가 있는 운영에서 데모 승인으로는 못 연다`)
  const r = await call('POST', { action: 'confirm', orderId: c.orderId, paymentKey: 'pk_1', amount: c.amount, ticket: c.ticket, input: inp })
  const sent = seen.find(x => x.u.includes('/confirm'))
  ok(r.ok && r.mode === 'toss' && sent && sent.body.amount === want && sent.body.orderId === c.orderId, `${label} — 토스에 보낸 금액 ${sent && sent.body.amount}, 승인되면 풀이 전부`)
  ok(sent && sent.auth === 'Basic ' + Buffer.from('live_gsk_가짜열쇠:').toString('base64'), `${label} — 비밀 열쇠로 서명`)
  const rs = await call('POST', { action: 'restore', input: inp })
  ok(rs.ok, `${label} — 새로 고침 뒤 다시 열림`)
}
// 거절·이미 처리
{
  jar = {}; toss = { mode: 'fail' }
  const c = await call('POST', { action: 'create', input: baby })
  const r = await call('POST', { action: 'confirm', orderId: c.orderId, paymentKey: 'pk_2', amount: c.amount, ticket: c.ticket, input: baby })
  ok(!r.ok && r.code === 'REJECT_CARD_COMPANY' && !(await call('POST', { action: 'restore', input: baby })).ok, '카드사 거절이면 풀이도 증표도 없다')
  toss = { mode: 'again', orderId: c.orderId, total: PRICE.baby }
  const r2 = await call('POST', { action: 'confirm', orderId: c.orderId, paymentKey: 'pk_3', amount: c.amount, ticket: c.ticket, input: baby })
  ok(r2.ok, '이미 처리된 결제(두 번 누름)는 토스에서 같은 주문·같은 금액을 확인하면 연다')
  jar = {}; toss = { mode: 'again', orderId: 'ms_남의주문', total: PRICE.baby }
  const c2 = await call('POST', { action: 'create', input: baby })
  const r3 = await call('POST', { action: 'confirm', orderId: c2.orderId, paymentKey: 'pk_4', amount: c2.amount, ticket: c2.ticket, input: baby })
  ok(!r3.ok, '이미 처리됐다며 남의 주문 결제를 들이밀면 막힘')
}
// 열쇠 짝이 틀리면 닫힘
process.env.TOSS_CLIENT_KEY = 'test_gck_x'
ok((await call('GET', null, '/api/order')).mode === 'closed', '테스트 열쇠와 운영 열쇠를 섞어 넣으면 창구가 닫힌다')
console.log(bad ? `\n틀림 ${bad}` : '\n토스 승인 시험 모두 통과')
process.exit(bad ? 1 : 0)
