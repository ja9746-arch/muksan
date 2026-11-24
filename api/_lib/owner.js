/* 주인 열쇠 — 사장님이 결제 없이 제 서비스를 들여다보는 길.
 *
 * 2026-11-13: 다섯 곳 결제벽을 서버에서 전부 막아 놓으니 사장님도 제 물건을
 * 보려면 매번 돈을 내야 했다. 손님에게 뭐가 나가는지 제일 자주 봐야 하는
 * 사람이 사장님인데 그러면 안 된다.
 *
 * 쓰는 법
 *   한 번만   주소 뒤에 ?주인=<OWNER_PASS> 를 붙여 들어온다
 *   그 뒤로는 그 기기에서 결제 없이 열린다 (30일)
 *
 * 지키는 것
 *   - OWNER_PASS 가 없거나 짧으면(16자 미만) 이 문은 아예 안 열린다.
 *     설정을 깜빡한 서비스가 통째로 뚫리는 것을 막는다.
 *   - 기기에 심는 표에는 비밀값이 한 자도 안 들어간다. 값으로 만든 지문뿐이다.
 *     쿠키를 들여다봐도 열쇠를 알 수 없고, 값을 바꾸면 전에 심은 표도 같이 죽는다.
 *   - 표는 httpOnly 라 화면 글이 읽지 못한다.
 *   - 주인으로 연 것은 매출에 올리지 않는다. 진짜 매출과 섞이면 숫자가 거짓이 된다.
 */
import crypto from 'node:crypto'

const 쿠키이름 = 'bg_owner'
const 서른날 = 30 * 24 * 60 * 60

const 열쇠 = () => {
  const v = (process.env.OWNER_PASS || '').trim()
  return v.length >= 16 ? v : ''
}
const 지문 = (v) => crypto.createHmac('sha256', v).update('owner-pass').digest('hex').slice(0, 32)

function 같나(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''))
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y)
}

function 쿠키읽기(req, 이름) {
  const raw = req.headers?.cookie || ''
  for (const part of raw.split(';')) {
    const s = part.trim()
    if (s.startsWith(이름 + '=')) return decodeURIComponent(s.slice(이름.length + 1))
  }
  return ''
}

function 표심기(res, 값) {
  const 이전 = res.getHeader('set-cookie')
  const 줄 = `${쿠키이름}=${encodeURIComponent(값)}; Max-Age=${서른날}; Path=/; HttpOnly; Secure; SameSite=Lax`
  res.setHeader('set-cookie', 이전 ? [].concat(이전, 줄) : 줄)
}

/** 이 요청이 주인인가. 표가 있으면 참, 없으면 거짓. */
export function 주인인가(req) {
  const v = 열쇠()
  if (!v) return false
  return 같나(쿠키읽기(req, 쿠키이름), 지문(v))
}

/** ?주인=<값> 으로 들어온 요청이면 표를 심는다. 심었으면 참. */
export function 주인표심기(req, res, 보낸값) {
  const v = 열쇠()
  if (!v || !같나(보낸값, v)) return false
  표심기(res, 지문(v))
  return true
}

/** 주인 열쇠가 설정돼 있나 — 화면에 '주인으로 열기'를 보일지 정하는 데만 쓴다. */
export const 주인열쇠있나 = () => !!열쇠()
