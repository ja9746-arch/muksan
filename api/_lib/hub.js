/* 대문(백귀야행도) 관리 화면에 결제 기록을 알려 준다 — 백택과 같은 길.
 *
 * 토스가 결제 원본이고, 여기서 보내는 것은 토스가 모르는 것뿐이다 —
 * 결제가 들어왔는지, 손님이 기록을 열어 봤는지. 환불을 가릴 때 쓰는 자리다.
 * 개인정보는 한 자도 보내지 않는다(주문번호·금액·때·들어온 곳만).
 *
 * 환경 변수
 *   HUB_RECORD_URL  기본 https://100gwi.com/api/record
 *   RECORD_SECRET   대문과 같은 값이어야 한다. 없으면 조용히 아무것도 안 한다.
 *
 * 손님을 오래 기다리게 하지 않는다 — 4초씩 두 번까지만 해 보고 접는다.
 */
import crypto from 'node:crypto'

export const SERVICE = '묵산작명원'      // 대문 기록 창구가 받는 서비스 이름
// 무엇을 팔았나 — 관리 화면에 '묵산작명원 · 아기 이름'처럼 찍힌다(상품마다 다르다)
const ITEMS = { baby: '아기 이름', rename: '개명 이름', gamjeong: '이름 감정', hanja: '한자 바꾸기' }
const URL_ = () => process.env.HUB_RECORD_URL || 'https://100gwi.com/api/record'
// 이름을 소문자(record_secret)로 넣어도 읽는다 — 백목귀 프로젝트에 소문자로 들어가 있어, 같은 꼴로 옮겨 넣을 때 조용히 꺼지지 않게
const 비밀 = () => (process.env.RECORD_SECRET || process.env.record_secret || '').trim()
export const 대문비밀 = 비밀

async function 보내기(body) {
  // 입내작에서 알림 두 건이 빠진 일이 있었다(2026-11) — 한 번 끊기면 한 번 더 보낸다.
  // 대문이 답을 했으면(500 아래) 되묻지 않는다. 같은 주문·같은 일은 대문이 겹쳐 세지 않는다.
  for (let 번 = 0; 번 < 2; 번++) {
    const ctrl = new AbortController()
    const 끊기 = setTimeout(() => ctrl.abort(), 4000)
    try {
      const r = await fetch(URL_(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal })
      if (r.status < 500) { if (!r.ok) console.error('대문 알림 거절', body.event, r.status); return }
      console.error('대문 알림 실패', body.event, r.status)
    } catch (e) {
      console.error('대문 알림 끊김', body.event, String(e?.message || e).slice(0, 80))
    } finally { clearTimeout(끊기) }
  }
}

/** 결제됨(paid)·열어 봄(opened) */
export async function 대문에알림(id, event, amount, from, kind) {
  const s = 비밀()
  if (!s || !id) return
  const sig = crypto.createHmac('sha256', s).update(`${id}|${event}`).digest('hex').slice(0, 32)
  await 보내기({ sig, id, service: SERVICE, item: ITEMS[kind] || '이름', from: from || '', event, amount })
}

/** 무료 구간(첫 기록)을 봤다 — 전환율을 재는 자리. 날짜와 서비스 이름뿐이다. */
export async function 무료봤다() {
  const s = 비밀()
  if (!s) return
  const sig = crypto.createHmac('sha256', s).update(`free|${SERVICE}`).digest('hex').slice(0, 32)
  await 보내기({ sig, service: SERVICE, event: 'free' })
}

/** 대문 관리 화면이 '알림 켜짐'과 열쇠 지문을 견주는 자리. 값은 내보내지 않는다. */
export const 열쇠지문 = (v) => v ? crypto.createHmac('sha256', v).update('record-secret-fingerprint').digest('hex').slice(0, 8) : ''
