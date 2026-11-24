// 《묵산작명원》 결제 창구 — 연연라·반야와 같은 토스 결제창형(gck/gsk) 길.
//
//   GET                                  → 결제 방식(미리보기/토스/주인)과 토스 클라이언트 키, 상품별 값
//   GET ?check=record                    → 대문 결제 알림이 켜져 있나(열쇠 지문만, 값은 안 냄)
//   POST 주인    {값}                     → 주인 열쇠가 맞으면 이 기기에 주인 표를 심는다
//   POST create  {input, from}            → 주문번호와 표(ticket) 발급 — 값은 input.kind(상품)로 정한다
//   POST confirm {orderId, paymentKey, amount, ticket, input, from}
//                                         → 토스에 승인을 받고, 결제 증표 쿠키를 심고, 풀이 전부를 돌려준다
//   POST restore {input}                  → 이 입력의 결제 증표가 있으면 풀이 전부를 돌려준다(새로 고침 뒤)
//
// 묵산작명원은 손님이 넣은 성·생년월일·이름을 서버에 저장하지 않는다. 결제 원본은 토스에 있고,
// 대문 관리 화면에는 주문번호·금액·때·들어온 곳·상품만 알린다. 결제했다는 사실은 서명한 쿠키로 손님 기기에 둔다.
import crypto from 'node:crypto'
import { fullView, cleanInput, fingerprint, PRODUCTS } from './_engine/muksan.js'
import { PRICE, ORDER_NAME, PREFIX } from './_lib/price.js'
import { 표만들기, 표맞나, 결제했나, 증표심기 } from './_lib/pass.js'
import { 대문에알림, 열쇠지문, 대문비밀 } from './_lib/hub.js'
import { 주인인가, 주인표심기 } from './_lib/owner.js'

// 토스페이먼츠 공개 문서용 테스트 키(돈이 나가지 않음) — 열쇠가 없을 때 ?pay=toss 로 열어 볼 때만 쓴다.
const DOC_TEST = { client: 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm', secret: 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6' }
const 들어온곳 = v => { const t = String(v || '').slice(0, 24); return /^[a-z0-9_-]{1,24}$/i.test(t) ? t : '' }
const 짝맞나 = (c, k) => c.startsWith('test_') === k.startsWith('test_')

/* 데모판(2026-11-24): 열쇠가 없으면 미리보기로 돈 없이 풀이 전부를 연다 — 지인 평가용 주소에서만 쓴다.
   ★ 100gwi.com 대문에 붙이기 전에 반드시 둘 중 하나를 한다(연연라 2026-11-24 와 같은 지킴).
     ① 토스 열쇠 두 개를 넣고 다시 배포한다 → 토스로 열린다
     ② 열쇠 없이 붙일 거면 아래 MUKSAN_DEMO 줄을 지운다 → 운영에서는 창구가 '점검 중'으로 닫힌다
   대문 주소(100gwi.com)를 거쳐 온 요청이면 미리보기를 쓰지 않는다(아래 대문경유). */
const MUKSAN_DEMO = true
const 대문경유 = req => /(^|\.)100gwi\.com$/i.test(String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim().split(':')[0])
function payConfig(wantTest, req) {
  const c = (process.env.TOSS_CLIENT_KEY || '').trim(), k = (process.env.TOSS_SECRET_KEY || '').trim()
  if (c && k) {
    if (!짝맞나(c, k)) { console.error('[pay] 토스 열쇠 짝이 안 맞는다', c.slice(0, 5), k.slice(0, 5)); return { mode: 'closed', reason: 'KEY_PAIR_MISMATCH' } }
    return { mode: 'toss', client: c, secret: k, live: !c.startsWith('test_') }
  }
  if (process.env.VERCEL_ENV === 'production' && (!MUKSAN_DEMO || 대문경유(req))) return { mode: 'closed', reason: 'NO_KEY' }
  if (wantTest) return { mode: 'toss', client: DOC_TEST.client, secret: DOC_TEST.secret, live: false, doc: true }
  return { mode: 'demo' }
}

function send(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.end(JSON.stringify(body))
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  let raw = ''
  for await (const c of req) { raw += c; if (raw.length > 6000) throw new Error('too big') }
  return raw ? JSON.parse(raw) : {}
}
const rand = n => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', b = crypto.randomBytes(n); let s = ''; for (let i = 0; i < n; i++) s += A[b[i] % A.length]; return s }
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '')
const okId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(s)
const auth = secret => 'Basic ' + Buffer.from(secret + ':').toString('base64')

async function confirmToss(cfg, { paymentKey, orderId, amount }) {
  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: auth(cfg.secret), 'Content-Type': 'application/json', 'Idempotency-Key': 'confirm-' + orderId },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })
  const j = await r.json().catch(() => ({}))
  if (r.ok && j.status === 'DONE') return { ok: true, pay: j }
  if (j.code === 'ALREADY_PROCESSED_PAYMENT') {
    const g = await fetch('https://api.tosspayments.com/v1/payments/' + encodeURIComponent(paymentKey), { headers: { Authorization: auth(cfg.secret) } })
    const p = await g.json().catch(() => ({}))
    if (g.ok && p.status === 'DONE' && p.orderId === orderId && Number(p.totalAmount) === amount) return { ok: true, pay: p, again: true }
  }
  return { ok: false, code: j.code || 'CONFIRM_FAILED', message: j.message || '결제 승인을 마치지 못했습니다.' }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://x')
      if (u.searchParams.get('check') === 'record') return send(res, 200, { ok: true, ready: !!대문비밀(), 지문: 열쇠지문(대문비밀()) })
      const cfg = payConfig(u.searchParams.get('pay') === 'toss', req)
      return send(res, 200, { ok: true, mode: 주인인가(req) ? 'owner' : cfg.mode, clientKey: cfg.client || null, live: !!cfg.live, price: PRICE, 주인: 주인인가(req), ...(cfg.reason ? { reason: cfg.reason } : {}) })
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false })
    let b; try { b = await readBody(req) } catch { return send(res, 400, { ok: false, code: 'BAD_REQUEST' }) }

    if (b.action === '주인') {
      const ok = 주인표심기(req, res, String(b.값 || ''))
      return send(res, 200, { ok, 주인: ok })
    }

    const o = cleanInput(b.input)
    if (!o || !PRODUCTS.includes(o.kind)) return send(res, 400, { ok: false, code: 'BAD_INPUT', message: '넣으신 값을 다시 확인해 주십시오.' })
    const 지문 = fingerprint(o), 값 = PRICE[o.kind]
    const 전부 = () => fullView(o)

    if (b.action === 'create') {
      try { 전부() } catch (e) { return send(res, 200, { ok: false, code: e.code || 'BAD_INPUT', message: '태어난 날을 다시 확인해 주십시오.' }) }
      const 주인 = 주인인가(req)
      const cfg = 주인 ? { mode: 'owner', client: null, live: false } : payConfig(!!b.test, req)
      if (cfg.mode === 'closed') return send(res, 200, { ok: false, code: cfg.reason, message: '결제 창구를 점검하는 중입니다. 잠시 뒤 다시 와 주십시오.' })
      const amount = 주인 ? 0 : 값
      const orderId = PREFIX + kst() + rand(18)
      return send(res, 200, { ok: true, orderId, amount, orderName: ORDER_NAME[o.kind], mode: cfg.mode, clientKey: cfg.client || null, ticket: 표만들기(orderId, 지문, cfg.mode, amount) })
    }

    if (b.action === 'confirm') {
      const { orderId, paymentKey } = b, amount = Number(b.amount)
      if (!okId(orderId) || typeof paymentKey !== 'string' || paymentKey.length > 200) return send(res, 400, { ok: false, code: 'BAD_REQUEST' })
      const from = 들어온곳(b.from)
      if (paymentKey === 'owner_' + orderId) {
        if (!주인인가(req) || !표맞나(b.ticket, orderId, 지문, 'owner', 0)) return send(res, 200, { ok: false, code: 'BAD_PAYMENT', message: '주인 표를 확인하지 못했습니다.' })
        증표심기(req, res, 지문, orderId, 'owner')
        return send(res, 200, { ok: true, orderId, mode: 'owner', eng: 전부() })
      }
      if (paymentKey === 'demo_' + orderId) {
        if (payConfig(false, req).mode !== 'demo' || !표맞나(b.ticket, orderId, 지문, 'demo', 값)) return send(res, 200, { ok: false, code: 'BAD_PAYMENT', message: '결제를 확인하지 못했습니다.' })
        증표심기(req, res, 지문, orderId, 'demo')
        return send(res, 200, { ok: true, orderId, mode: 'demo', eng: 전부() })
      }
      if (amount !== 값) return send(res, 200, { ok: false, code: 'AMOUNT_MISMATCH', message: '결제 금액이 주문과 다릅니다.' })
      if (!표맞나(b.ticket, orderId, 지문, 'toss', 값)) return send(res, 200, { ok: false, code: 'BAD_TICKET', message: '주문을 확인하지 못했습니다.' })
      const cfg = payConfig(!!b.test, req)
      if (cfg.mode !== 'toss') return send(res, 200, { ok: false, code: 'NO_KEY', message: '결제 설정을 확인하지 못했습니다.' })
      const t = await confirmToss(cfg, { paymentKey, orderId, amount: 값 })
      if (!t.ok) return send(res, 200, { ok: false, code: t.code, message: t.message })
      증표심기(req, res, 지문, orderId, cfg.live ? 'toss' : 'toss-test')
      if (!t.again) { await 대문에알림(orderId, 'paid', 값, from, o.kind); await 대문에알림(orderId, 'opened', 값, from, o.kind) }
      return send(res, 200, { ok: true, orderId, mode: 'toss', live: !!cfg.live, eng: 전부() })
    }

    if (b.action === 'restore') {
      const hit = 결제했나(req, 지문)
      if (!hit) return send(res, 200, { ok: false, code: 'NOT_PAID' })
      return send(res, 200, { ok: true, orderId: hit.orderId, mode: hit.mode, eng: 전부() })
    }
    return send(res, 400, { ok: false, code: 'BAD_ACTION' })
  } catch (e) {
    console.error(e)
    return send(res, 500, { ok: false, code: 'SERVER_ERROR', message: '잠시 연결이 불안정합니다. 다시 눌러 주십시오.' })
  }
}
