/* 결제 증표 — 결제한 풀이만 열리게 서버가 가린다(반야와 같은 길).
 *
 * 묵산작명원은 손님이 넣은 성·생년월일·이름을 서버에 쌓지 않는다. '결제했다'는 것을 저장소에 적는 대신,
 * 서버만 만들 수 있는 서명을 손님 기기의 쿠키(ms_paid, 30일, httpOnly)에 심는다.
 * 쿠키에는 넣은 값이 아니라 그 값으로 만든 지문(앞 24자)만 들어간다.
 *
 *   주문을 만들 때   표(ticket) = 서명(주문번호 | 입력 지문 | 방식 | 금액)
 *   승인되면         증표 = 서명(입력 지문 | 주문번호 | 방식 | 끝나는 때) 를 쿠키에
 *   PDF·다시 열기    같은 입력의 증표가 있어야 '결제한 풀이'로 엮는다
 *
 * 서명 열쇠는 토스 시크릿 키에서 뽑는다(새 비밀값을 따로 넣지 않아도 되게).
 * 열쇠가 없는 미리보기에서는 고정 글귀로 서명한다 — 그때는 어차피 돈을 안 받는다.
 */
import crypto from 'node:crypto'

const 쿠키 = 'ms_paid'
const 서른날 = 30 * 24 * 3600

const 열쇠 = () => crypto.createHmac('sha256', (process.env.TOSS_SECRET_KEY || '').trim() || 'muksan-demo-preview').update('muksan-pass-v1').digest()
const 서명 = s => crypto.createHmac('sha256', 열쇠()).update(s).digest('base64url').slice(0, 32)
const 같나 = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y) }

export const 표만들기 = (orderId, 지문, mode, amount) => 서명(`t|${orderId}|${지문}|${mode}|${amount}`)
export const 표맞나 = (ticket, orderId, 지문, mode, amount) => 같나(ticket, 표만들기(orderId, 지문, mode, amount))

function 쿠키읽기(req) {
  const raw = req.headers?.cookie || ''
  for (const part of raw.split(';')) { const s = part.trim(); if (s.startsWith(쿠키 + '=')) return decodeURIComponent(s.slice(쿠키.length + 1)) }
  return ''
}
function 증표들(req) {
  const v = 쿠키읽기(req); if (!v) return []
  const [몸, sig] = v.split('.')
  if (!몸 || !같나(sig, 서명('p|' + 몸))) return []
  try {
    const list = JSON.parse(Buffer.from(몸, 'base64url').toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    return Array.isArray(list) ? list.filter(x => x && typeof x.k === 'string' && x.x > now).slice(-12) : []
  } catch { return [] }
}
/** 이 입력의 결제 증표가 있나. 있으면 {주문번호, 방식} */
export function 결제했나(req, 지문) {
  const hit = 증표들(req).find(x => x.k === 지문)
  return hit ? { orderId: hit.o, mode: hit.m } : null
}
/** 승인된 결제를 쿠키에 더한다(같은 입력은 새 것으로, 많아야 열둘). */
export function 증표심기(req, res, 지문, orderId, mode) {
  const list = 증표들(req).filter(x => x.k !== 지문)
  list.push({ k: 지문, o: orderId, m: mode, x: Math.floor(Date.now() / 1000) + 서른날 })
  const 몸 = Buffer.from(JSON.stringify(list.slice(-12)), 'utf8').toString('base64url')
  const secure = (req.headers['x-forwarded-proto'] || 'https') === 'https' ? '; Secure' : ''
  const 줄 = `${쿠키}=${encodeURIComponent(몸 + '.' + 서명('p|' + 몸))}; Max-Age=${서른날}; Path=/; HttpOnly${secure}; SameSite=Lax`
  const 이전 = res.getHeader('set-cookie')
  res.setHeader('set-cookie', 이전 ? [].concat(이전, 줄) : 줄)
}
