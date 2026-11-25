// 《묵산작명원》 무료 창구 — 결제 전에 보여 주는 것만 내보낸다.
//   GET  ?eum=도              → 그 소리로 쓸 수 있는 인명용 한자(이름에 자주 쓰는 글자 먼저)
//   GET  ?sur=1               → 성씨 소리와 한자 목록
//   GET  ?si=1&cal=&y=&m=&d=  → 그날의 시진 구간(태어난 시 고르기)
//   POST {input}              → 무료 풀이(만세력 · 사주 요약 · 봉해 둔 이름의 점수 · 감정 세 잣대)
// 손님이 넣은 값은 저장하지 않는다.
import { freeView, cleanInput, hanjaFor, HANJA_COUNT, sijinOf } from './_engine/muksan.js'
import { SURNAMES } from './_data/pool.js'
import { PRICE } from './_lib/price.js'
import { 무료봤다 } from './_lib/hub.js'

function send(res, code, body, cache) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', cache || 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.end(JSON.stringify(body))
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  let raw = ''
  for await (const c of req) { raw += c; if (raw.length > 4000) throw new Error('too big') }
  return raw ? JSON.parse(raw) : {}
}
const SUR_LIST = Object.entries(SURNAMES).map(([k, v]) => [k, Array.isArray(v) ? v : [...v]])

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://x')
      if (u.searchParams.get('sur')) return send(res, 200, { ok: true, list: SUR_LIST, price: PRICE, count: HANJA_COUNT }, 'public, max-age=3600')
      // 그날의 시진 구간(태어난 시 고르기) — 표준시·서머타임에 따라 구간이 달라진다
      if (u.searchParams.get('si')) {
        const q = k => Number(u.searchParams.get(k)), cal = u.searchParams.get('cal')
        const y = q('y'), m = q('m'), d = q('d')
        if (!['양력', '음력', '윤달'].includes(cal) || !Number.isInteger(y) || y < 1920 || y > 2030 || !Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > 31) return send(res, 400, { ok: false })
        const r = sijinOf({ cal, y, m, d })
        return r ? send(res, 200, { ok: true, ...r }, 'public, max-age=86400') : send(res, 200, { ok: false })
      }
      const eum = String(u.searchParams.get('eum') || '').slice(0, 1)
      if (!/^[가-힣]$/.test(eum)) return send(res, 400, { ok: false })
      return send(res, 200, { ok: true, eum, list: hanjaFor(eum) }, 'public, max-age=86400')
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false })
    let b; try { b = await readBody(req) } catch { return send(res, 400, { ok: false, code: 'BAD_REQUEST' }) }
    const o = cleanInput(b.input)
    if (!o) return send(res, 400, { ok: false, code: 'BAD_INPUT', message: '넣으신 값을 다시 확인해 주십시오.' })
    let v
    try { v = freeView(o) } catch (e) { return send(res, 200, { ok: false, code: e.code || 'BAD_INPUT', message: '태어난 날을 다시 확인해 주십시오.' }) }
    if (o.kind !== 'manse') await 무료봤다()
    return send(res, 200, { ok: true, view: v, price: PRICE })
  } catch (e) {
    console.error(e)
    return send(res, 500, { ok: false, code: 'SERVER_ERROR', message: '잠시 연결이 불안정합니다. 다시 눌러 주십시오.' })
  }
}
