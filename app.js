/* 묵산작명원 화면 — 계산은 모두 서버(api/)에서 한다. 여기는 보여 주기만 한다. */
(() => {
'use strict'
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches
const won = n => Number(n || 0).toLocaleString('ko-KR')
const SS = { get: k => { try { return JSON.parse(sessionStorage.getItem(k)) } catch (e) { return null } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k) } catch (e) {} } }
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), credentials: 'same-origin' }).then(r => r.json())
let toastT = 0
const toast = (t, ms = 2800) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms) }
const Q = new URLSearchParams(location.search)
const WANT_TOSS = Q.get('pay') === 'toss'
const FROM = /^[a-z0-9_-]{1,24}$/i.test(Q.get('from') || '') ? Q.get('from') : ''

const EL = { 木: 'mok', 火: 'hwa', 土: 'to', 金: 'geum', 水: 'su' }
const ELKO = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' }
const bat = w => { const c = String(w).replace(/\([^()]*\)$/, '').slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0 }
const 이가 = w => w + (bat(w) ? '이' : '가')
const TEN = [
 ['plum', '사주 보완', '모자란 기운을 채우나'], ['roots', '글자 뿌리', '자원오행이 서로 살리나'],
 ['rods', '수리 사격', '원·형·이·정 네 격이 길한가'], ['sunmoon', '음양', '획수 홀짝이 어울리나'],
 ['bell', '소리 오행', '두 학설로 따로 듣기'], ['wave', '부르는 맛', '받침이 넘어가도 괜찮나'],
 ['book', '뜻', '한자 뜻이 맑은가'], ['sieve', '인명용 한자', '출생신고가 되는 글자인가'],
 ['tags', '흔한 정도', '2025년 출생신고 순위'], ['scale', '놀림·피하는 글자', '놀림말·불용문자'],
]
const KIND = { baby: '아기 이름 짓기', rename: '개명할 이름 짓기', gamjeong: '지어 둔 이름 감정', manse: '무료 만세력' }
let PRICE = { baby: 19900, rename: 19900, gamjeong: 4900 }, HC = 9089, SURN = new Map()
let PAYCFG = { mode: 'demo', price: PRICE }

/* ───────── 장면 ───────── */
let cur = 'home'
const show = (id, how = 'push') => {
 $$('.scene').forEach(s => s.classList.toggle('on', s.id === 's-' + id))
 if (how === 'push' && cur !== id) history.pushState({ s: id }, '')
 else if (how === 'replace') history.replaceState({ s: id }, '')
 cur = id; window.scrollTo(0, 0)
}
history.replaceState({ s: 'home' }, '')
addEventListener('popstate', e => {
 closeSheet(true)
 const id = (e.state && e.state.s) || 'home'
 if (id === 'grind') return history.back()
 if ((id === 'free' && !S.free) || (id === 'full' && !S.full) || (id === 'manse' && !S.manse)) return show('home', 'none')
 show(id, 'none')
})
$$('[data-back]').forEach(b => b.addEventListener('click', () => history.length > 1 ? history.back() : show('home', 'replace')))
$$('[data-home]').forEach(b => b.addEventListener('click', () => { show('home', 'push') }))

/* ───────── 대문 ───────── */
const S = { kind: null, input: null, free: null, full: null, manse: null, picks: [], page: 0 }
$('#tenList').innerHTML = TEN.map(([ic, t, d], i) => `<li><i aria-hidden="true">${'一二三四五六七八九十'[i]}</i><img src="img/icon-${ic}.webp" alt="" loading="lazy"><div><b>${t}</b><span>${d}</span></div></li>`).join('')
const priceFill = () => $$('[data-price]').forEach(e => { const p = PRICE[e.dataset.price]; if (p) e.textContent = won(p) + '원' })
fetch('api/name?sur=1').then(r => r.json()).then(j => {
 if (!j || !j.ok) return
 PRICE = j.price; HC = j.count; SURN = new Map(j.list); priceFill()
 $$('[data-hc]').forEach(e => e.textContent = won(HC))
}).catch(() => {})
priceFill()
/* 거르는 수 — 줄마다 먹 막대. 9천에서 수십까지 한 화면에 보이게 막대 길이는 로그로 잰다 */
const funnelRows = (f, last) => {
 const R = [['인명용 한자', f.전체, '자'], ['이름에 쓰는 글자로 엮은 조합', f.이름글자], ['수리 사격 넷이 모두 길한 것', f.수리],
  ['음양이 어울리는 것', f.음양], ['소리가 부딪치지 않는 것', f.소리], ['사주에 모자란 기운을 채우는 것', f.사주]]
 if (f.늦춤) R.push(['엄한 잣대를 모두 넘은 이름', f.남은이름, '개'], ['돌림자 때문에 소리를 점수로만 보고 더 찾은 이름', f.늦춤, '개'])
 R.push([last, f.늦춤 ? f.남은이름 + f.늦춤 : f.남은이름, '개', 1])
 const top = Math.log10(Math.max(...R.slice(1).map(r => r[1] || 1), 10)), lo = Math.log10(Math.max(1, Math.min(...R.map(r => r[1] || 1)) / 3))
 const w = v => Math.max(3, Math.round(((Math.log10(Math.max(v, 1)) - lo) / (top - lo || 1)) * 100))
 // 첫 줄(글자 수)은 단위가 달라 막대를 두지 않는다 — 둘째 줄부터가 체로 줄어드는 이름 수
 return R.map(([a, v, u, l], i) => `<div class="sv${l ? ' last' : ''}"><span>${a}</span><b>${won(v)}${u || ''}</b>${i ? `<em style="--w:${w(v)}%"></em>` : ''}</div>`).join('')
}
post('api/name', { input: { kind: 'baby', sex: '남', cal: '양력', y: 2026, m: 3, d: 14, h: 8, mi: 0, sur: '김', surHj: '金' } })
 .then(j => { if (j && j.ok) $('#sieveDemo').innerHTML = funnelRows(j.view.funnel, '남은 이름') }).catch(() => {})

/* ───────── 의뢰서 ───────── */
const F = { kind: 'baby', sex: null, cal: '양력', surHj: null, givenHj: [], dolHj: null, dolPos: 2, wish: [] }
const WISHES = ['밝음', '지혜', '굳셈', '넉넉함', '바름', '평안', '큰뜻', '고움']
$('#wish').innerHTML = WISHES.map(w => `<button type="button" class="pill sm" data-v="${w}" aria-pressed="false">${w === '큰뜻' ? '큰 뜻' : w}</button>`).join('')
$('#h').innerHTML = '<option value="">시를 모릅니다</option>' + Array.from({ length: 24 }, (_, i) => `<option value="${i}">${i < 12 ? '오전' : '오후'} ${i % 12 || 12}시</option>`).join('')
$('#mi').innerHTML = [0, 10, 20, 30, 40, 50].map(m => `<option value="${m}">${String(m).padStart(2, '0')}분</option>`).join('')
const onlyOne = (box, key, after) => box.addEventListener('click', e => {
 const b = e.target.closest('.pill'); if (!b) return
 box.querySelectorAll('.pill').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'))
 F[key] = b.dataset.v; after && after()
})
onlyOne($('#sex'), 'sex'); onlyOne($('#cal'), 'cal'); onlyOne($('#dolPos'), 'dolPos')
$('#wish').addEventListener('click', e => {
 const b = e.target.closest('.pill'); if (!b) return
 const v = b.dataset.v, on = F.wish.includes(v)
 if (!on && F.wish.length >= 2) return toast('뜻은 둘까지 고를 수 있습니다')
 F.wish = on ? F.wish.filter(x => x !== v) : [...F.wish, v]
 b.setAttribute('aria-pressed', on ? 'false' : 'true')
})
const hanjaCache = new Map()
const hanjaOf = eum => hanjaCache.get(eum) || (hanjaCache.set(eum, fetch('api/name?eum=' + encodeURIComponent(eum)).then(r => r.json()).then(j => j && j.ok ? j.list : []).catch(() => [])), hanjaCache.get(eum))
const hunFull = (hun, eum) => String(hun || '').split(', ').filter(Boolean).map(w => `${w} ${eum}`).join(', ')
function picker(box, eum, chosen, onPick, label) {
 return hanjaOf(eum).then(list => {
  const wrap = document.createElement('div')
  if (!list.length) { wrap.innerHTML = `<p class="pk-h">‘${esc(eum)}’ 소리로 쓸 수 있는 인명용 한자가 없습니다.</p>`; box.appendChild(wrap); return }
  let full = false
  const draw = () => {
   const L = full ? list : list.slice(0, 16), cx = list.find(x => x.h === chosen())
   // 고른 글자는 뜻을 줄이지 않고 다 적는다 — 칸에는 두 줄까지만 들어가므로
   const sel = cx ? `<div class="pk-sel" aria-live="polite"><b>${esc(cx.h)}</b><span><em>${esc(hunFull(cx.hun, eum))}</em><small>원획 ${cx.won}획 · 뿌리 기운 ${ELKO[cx.el] || ''}(${esc(cx.el || '')})${cx.pool ? ' · 이름에 자주 쓰는 글자' : ''}</small></span></div>` : ''
   wrap.innerHTML = `<p class="pk-h">${label} ‘${esc(eum)}’ — ${cx ? '고른 글자' : '한자를 골라 주십시오'}</p>${sel}<div class="picker">${L.map(x => `<button type="button" data-h="${esc(x.h)}" aria-pressed="${x.h === chosen()}" aria-label="${esc(x.h)} ${esc(hunFull(x.hun, eum))}"><b>${esc(x.h)}</b><span>${esc(x.hun || '')}</span></button>`).join('')}</div>${!full && list.length > 16 ? `<button type="button" class="more">글자 ${list.length - 16}개 더 보기</button>` : ''}`
  }
  draw()
  wrap.addEventListener('click', e => {
   if (e.target.closest('.more')) { full = true; return draw() }
   const b = e.target.closest('[data-h]'); if (!b) return
   onPick(b.dataset.h); draw()
   const x = list.find(y => y.h === b.dataset.h); x && toast(`${x.h} — ${hunFull(x.hun, eum)}`, 2600)
  })
  box.appendChild(wrap)
 })
}
const isHangul = s => /^[가-힣]+$/.test(s)
let surT = 0
$('#sur').addEventListener('input', () => {
 clearTimeout(surT); surT = setTimeout(() => {
  const v = $('#sur').value.trim(), box = $('#surHj'); box.innerHTML = ''; F.surHj = null; $('#e-sur').textContent = ''
  if (!v) return
  const opts = SURN.get(v)
  if (!opts) { if (isHangul(v) && SURN.size) $('#e-sur').textContent = '목록에 없는 성입니다. 고객센터로 알려 주시면 넣어 드립니다.'; return }
  F.surHj = opts[0]
  box.innerHTML = opts.map((h, i) => `<button type="button" class="pill sm" data-v="${h}" aria-pressed="${i === 0}">${h}</button>`).join('')
 }, 200)
})
$('#surHj').addEventListener('click', e => { const b = e.target.closest('.pill'); if (!b) return; $$('#surHj .pill').forEach(x => x.setAttribute('aria-pressed', x === b)); F.surHj = b.dataset.v })
let givT = 0
$('#given').addEventListener('input', () => {
 clearTimeout(givT); givT = setTimeout(async () => {
  const v = $('#given').value.trim(), box = $('#givenPick'); box.innerHTML = ''; $('#e-given').textContent = ''
  F.givenHj = []
  if (!v) return
  if (!isHangul(v)) { $('#e-given').textContent = '이름은 한글로 적어 주십시오.'; return }
  for (let i = 0; i < [...v].length; i++) {
   const k = i; await picker(box, [...v][k], () => F.givenHj[k], h => { F.givenHj[k] = h }, `${k + 1}째 글자`)
  }
 }, 350)
})
let dolT = 0
$('#dol').addEventListener('input', () => {
 clearTimeout(dolT); dolT = setTimeout(() => {
  const v = $('#dol').value.trim(), box = $('#dolPick'); box.innerHTML = ''; F.dolHj = null
  if (v && isHangul(v)) picker(box, v, () => F.dolHj, h => { F.dolHj = h }, '돌림자')
 }, 300)
})
function openForm(kind) {
 F.kind = kind; S.kind = kind
 $('#formTitle').textContent = KIND[kind]
 const has = { sur: kind !== 'manse', given: kind === 'gamjeong' || kind === 'rename', dol: kind === 'baby' || kind === 'rename', wish: kind === 'baby' || kind === 'rename' }
 $('#f-sur').hidden = !has.sur; $('#f-given').hidden = !has.given; $('#f-dol').hidden = !has.dol; $('#f-wish').hidden = !has.wish
 $('#givenLab').textContent = kind === 'rename' ? '지금 이름 (넣으시면 함께 감정합니다)' : '감정할 이름'
 $('#sexLab').textContent = kind === 'baby' ? '아기 성별' : '성별'
 $('#y').placeholder = kind === 'baby' ? '2026' : '1990'
 $('#goImg').src = kind === 'manse' ? 'img/bd-manse.webp' : 'img/bd-next.webp'
 $('#goImg').alt = kind === 'manse' ? '만세력 펼치기' : '다음'
 $$('.err').forEach(e => e.textContent = '')
 show('form')
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.go)))
/* 감정에서 개명으로 — 넣었던 값을 의뢰서에 그대로 옮긴다 */
async function prefillRename(o) {
 openForm('rename')
 $('#sur').value = o.sur; $('#sur').dispatchEvent(new Event('input'))
 await sleep(260)
 const sb = $(`#surHj .pill[data-v="${o.surHj}"]`); sb && sb.click()
 $$('#sex .pill').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === o.sex)); F.sex = o.sex
 $$('#cal .pill').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === o.cal)); F.cal = o.cal
 $('#y').value = o.y; $('#m').value = o.m; $('#d').value = o.d
 $('#h').value = o.h == null ? '' : String(o.h); $('#mi').value = String(o.mi || 0); $('#mi').disabled = o.h == null
 $('#given').value = o.given || ''
 F.givenHj = [...(o.givenHj || '')]
 const box = $('#givenPick'); box.innerHTML = ''
 for (let i = 0; i < [...(o.given || '')].length; i++) { const k = i; await picker(box, [...o.given][k], () => F.givenHj[k], h => { F.givenHj[k] = h }, `${k + 1}째 글자`) }
 toast('감정에 넣으신 값을 그대로 옮겼습니다 · 돌림자가 있으면 넣고 ‘다음’을 누르십시오', 3600)
}

function readForm() {
 const k = F.kind, err = (id, t) => { $('#e-' + id).textContent = t; return null }
 $$('.err').forEach(e => e.textContent = '')
 const o = { kind: k }
 if (k !== 'manse') {
  const sur = $('#sur').value.trim()
  if (!sur) return err('sur', '성을 적어 주십시오.')
  if (!F.surHj) return err('sur', '성의 한자를 골라 주십시오.')
  o.sur = sur; o.surHj = F.surHj
 }
 if (k === 'gamjeong' || k === 'rename') {
  const g = $('#given').value.trim()
  if (k === 'gamjeong' && !g) return err('given', '감정할 이름을 적어 주십시오.')
  if (g) {
   if (!isHangul(g) || g.length > 3) return err('given', '이름은 한글 세 자까지 적어 주십시오.')
   const hj = [...g].map((_, i) => F.givenHj[i])
   if (hj.some(x => !x)) return err('given', '이름 글자마다 한자를 골라 주십시오.')
   o.given = g; o.givenHj = hj.join('')
  }
 }
 if (!F.sex) return err('sex', '성별을 골라 주십시오.')
 const y = +$('#y').value, m = +$('#m').value, d = +$('#d').value
 if (!(y >= 1920 && y <= 2030) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return err('date', '태어난 해·달·날을 숫자로 적어 주십시오.')
 Object.assign(o, { sex: F.sex, cal: F.cal, y, m, d, h: $('#h').value === '' ? null : +$('#h').value, mi: +$('#mi').value || 0 })
 if ((k === 'baby' || k === 'rename')) {
  const dk = $('#dol').value.trim()
  if (dk) { if (!F.dolHj) { toast('돌림자의 한자를 골라 주십시오'); return null } o.dolKo = dk; o.dolHj = F.dolHj; o.dolPos = +F.dolPos }
  o.wish = F.wish.slice()
 }
 return o
}
$('#h').addEventListener('change', () => { $('#mi').disabled = $('#h').value === '' })
$('#mi').disabled = true

/* ───────── 먹 가는 장면 ───────── */
const SAYS = {
 baby: [['사주 여덟 글자를 펼칩니다', '태어난 해·달·날·시를 만세력으로 셉니다'], ['모자란 기운을 찾습니다', '다섯 기운을 세어 이름이 채울 기운을 정합니다'], ['인명용 한자를 체로 거릅니다', '대법원 인명용 한자 가운데 이름에 쓰는 글자로'], ['원형이정 네 격을 맞춥니다', '81수에서 길한 수만 남깁니다'], ['소리를 두 학설로 듣습니다', '부딪치는 소리를 걸러 냅니다']],
 gamjeong: [['사주 여덟 글자를 펼칩니다', '태어난 해·달·날·시를 만세력으로 셉니다'], ['글자마다 뿌리를 캡니다', '자원오행과 원획을 셉니다'], ['원형이정 네 격을 셉니다', '81수에 비춰 봅니다'], ['열 가지 잣대로 잽니다', '소리·뜻·놀림까지']],
 manse: [['만세력을 펼칩니다', '절기와 시각을 맞춥니다'], ['다섯 기운을 셉니다', '나무·불·흙·쇠·물']],
}
SAYS.rename = SAYS.baby
async function grind(kind, job) {
 show('grind', 'push')
 const list = SAYS[kind] || SAYS.baby
 let done = false, out
 job.then(v => { out = v; done = true }, e => { out = { ok: false, message: '잠시 연결이 불안정합니다. 다시 눌러 주십시오.' }; done = true })
 const t0 = Date.now(), minMs = RM ? 400 : kind === 'manse' ? 1600 : 2600
 for (let i = 0; ; i++) {
  const [a, b] = list[Math.min(i, list.length - 1)]
  $('#say').textContent = a; $('#say2').textContent = b
  await sleep(RM ? 200 : 700)
  if (done && Date.now() - t0 >= minMs) break
  if (i > 60) break
 }
 return out
}
$('#form').addEventListener('submit', async e => {
 e.preventDefault()
 const o = readForm(); if (!o) { const er = $$('.err').find(x => x.textContent); er && er.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }
 S.input = o; S.free = S.full = null; S.picks = []; S.page = 0
 const r = await grind(o.kind, post('api/name', { input: o }))
 if (!r || !r.ok) { history.back(); return toast(r && r.message || '풀이를 펼치지 못했습니다. 다시 눌러 주십시오') }
 if (r.price) PRICE = r.price
 if (o.kind === 'manse') { S.manse = r.view; renderManse(); return show('manse', 'replace') }
 S.free = r.view
 // 같은 값으로 이미 결제했으면(이 기기 30일) 다시 받지 않고 바로 연다
 const rs = await post('api/order', { action: 'restore', input: o }).catch(() => null)
 if (rs && rs.ok) { S.full = rs.eng; renderFull(); toast('이미 결제한 풀이입니다 · 다시 결제하지 않고 열어 드립니다'); return show('full', 'replace') }
 renderFree(); show('free', 'replace')
})

/* ───────── 사주 그리기 ───────── */
const COLS = ['시', '일', '월', '년']
function pillarsHTML(sj) {
 return `<div class="pillars">${sj.cols.map((c, i) => `<div><div class="h">${COLS[i]}주</div>${c ? `<b class="${i === 1 ? 'dm' : ''}">${esc(c.s)}</b><i>${esc(c.sk)} · ${ELKO[c.se]}</i><b>${esc(c.b)}</b><i>${esc(c.bk)} · ${ELKO[c.be]}</i>` : '<b style="color:var(--mute)">?</b><i>모름</i><b style="color:var(--mute)">?</b><i>모름</i>'}</div>`).join('')}</div>`
}
function elsHTML(sj, mark = true) {
 return `<div class="els">${Object.keys(EL).map(e => `<div class="${mark && (e === sj.yong) ? 'need' : ''} ${sj.raw[e] ? '' : 'zero'}"><img src="img/el-${EL[e]}.webp" alt="${ELKO[e]}(${e})"><b>${sj.raw[e]}</b><span>${mark && e === sj.yong ? '채울 기운' : mark && e === sj.hee ? '돕는 기운' : ELKO[e]}</span></div>`).join('')}</div>`
}
function sajuCard(sj, title = '타고난 사주') {
 return `<div class="card"><h2><img src="img/icon-plum.webp" alt="">${title}</h2>${pillarsHTML(sj)}${elsHTML(sj)}${(sj.lines || []).map(l => `<p>${esc(l)}</p>`).join('')}</div>`
}
function whenText(o, sj) {
 const t = o.h == null ? '태어난 시 모름' : `${o.h < 12 ? '오전' : '오후'} ${o.h % 12 || 12}시 ${String(o.mi || 0).padStart(2, '0')}분`
 const sol = sj.solar && o.cal !== '양력' ? ` (양력 ${sj.solar.year}.${sj.solar.month}.${sj.solar.day})` : ''
 return `${o.cal === '양력' ? '양력' : o.cal === '윤달' ? '음력 윤달' : '음력'} ${o.y}년 ${o.m}월 ${o.d}일 ${t}${sol} · ${o.sex === '남' ? '남자' : '여자'}`
}
function renderManse() {
 const sj = S.manse.saju, o = S.input
 $('#manseWhen').textContent = whenText(o, sj)
 const X = [52.7, 63.2, 73.4, 83.6], Y1 = 24.2, Y2 = 50.2, H = 26
 $('#book').innerHTML = `<img src="img/manse-book.webp" alt="萬歲曆" width="1254" height="1254">` + sj.cols.map((c, i) => `
  <span class="lab" style="left:${X[i]}%">${COLS[i]}주</span>
  <div class="cell ${i === 1 ? 'dm' : ''}" style="left:${X[i]}%;top:${Y1}%;height:${H}%"><b>${c ? esc(c.s) : '?'}</b><i>${c ? esc(c.sk) + ' ' + ELKO[c.se] : '모름'}</i></div>
  <div class="cell" style="left:${X[i]}%;top:${Y2}%;height:${H + 1}%"><b>${c ? esc(c.b) : '?'}</b><i>${c ? esc(c.bk) + ' ' + ELKO[c.be] : '모름'}</i></div>`).join('')
 $('#manseCard').innerHTML = `<h2><img src="img/icon-plum.webp" alt="">다섯 기운</h2>${elsHTML(sj)}${sj.lines.map(l => `<p>${esc(l)}</p>`).join('')}<p class="yong"><b>이름이 채울 기운</b> — ${이가(ELKO[sj.yong] + '(' + sj.yong + ')')} 첫째, ${이가(ELKO[sj.hee] + '(' + sj.hee + ')')} 둘째입니다. 이 기운의 한자로 이름을 지으면 사주의 빈자리를 메웁니다.</p><p class="note">날짜는 절기로 달을 가르고, 태어난 시는 서울 기준 30분을 보정해 셉니다(백귀사주 만세력과 같은 셈).</p>`
}

/* ───────── 무료 결과 ───────── */
const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째']
const SEALIMG = { 通: ['seal-tong', '열 잣대 모두 7점 넘음'], 補: ['seal-bo', '사주를 크게 보완'], 二說通: ['seal-iseol', '두 학설 모두 통과'], 薦: ['seal-cheon', '묵산이 첫째로 천거'] }
const msealHTML = seals => `<span class="mseal">${(seals || []).map(s => `<img src="img/${SEALIMG[s][0]}.webp" alt="${s}">`).join('')}</span>`
function priceCard(kind) {
 const items = {
  baby: ['봉한 이름 열 개와 다음 열 개 — 모두 스무 개', '이름마다 쉬운 말 한눈 풀이와 열 잣대 풀이', '이름이 더해진 팔자 — 이름이 사주의 빈자리를 어떻게 메우나', '마음에 드는 이름 셋까지 나란히 견주기', '고른 이름의 성명장과 풀이첩 — 사진 저장·인쇄'],
  rename: ['새 이름 스무 개와 이름마다 쉬운 말 한눈 풀이·열 잣대 풀이', '지금 이름 감정과 바꿀 방향(넣으신 경우)', '이름이 더해진 팔자 — 새 이름이 사주를 어떻게 채우나', '개명 허가 신청과 신고 순서 안내', '고른 이름의 성명장과 풀이첩 — 사진 저장·인쇄'],
  gamjeong: ['봉한 일곱 잣대 풀이와 총점·등급, 쉬운 말 한눈 풀이', '이름이 더해진 팔자 — 사주에 이름을 더하면 다섯 기운이 어떻게 바뀌나', '바꾼다면 어느 쪽으로 — 담을 기운·첫소리·획수와 개명 견본 이름 셋', '같은 소리로 점수가 더 높은 한자', '감명장과 풀이첩 — 사진 저장·인쇄'],
 }[kind]
 const btn = kind === 'gamjeong' ? ['bd-gam', '감정 받기'] : ['bd-pay', '결제하고 이름 받기']
 return `<div class="price"><h2>${KIND[kind]}</h2><ul>${items.map(t => `<li>${t}</li>`).join('')}</ul>
  <div class="won">${won(PRICE[kind])}<small>원</small></div><span class="paynote" id="paynote" hidden></span>
  <button class="cta" type="button" id="payBtn"><img src="img/${btn[0]}.webp" alt="${btn[1]} ${won(PRICE[kind])}원"></button>
  <p class="legal">결제하면 곧바로 풀이가 펼쳐집니다. 디지털 콘텐츠라 펼친 뒤에는 환불이 제한됩니다(전자상거래법 제17조 제2항). 오류로 풀이를 받지 못하면 전액 환불합니다. 결제하면 <a href="#" data-pol="terms">이용약관</a>과 <a href="#" data-pol="refund">환불정책</a>에 동의한 것으로 봅니다.</p></div>`
}
const miniLinks = '<p class="mini"><a href="#" data-pol="terms">약관</a>·<a href="#" data-pol="privacy">개인정보</a>·<a href="#" data-pol="refund">환불</a>·<a href="#" data-pol="biz">사업자정보</a></p>'
function renderFree() {
 const v = S.free, o = S.input, k = v.kind
 let h = ''
 if (k === 'gamjeong') {
  const n = v.name
  h += `<div class="pageh"><h1>${esc(n.full)} — 이름 감정</h1><p>${esc(whenText(o, v.saju))}</p></div>
  <div class="scroll"><img class="rt" src="img/rod-top.webp" alt=""><div class="body"><div class="vname">${[...n.fullHj].map((c, i) => `<div><b>${esc(c)}</b><span>${esc([...n.full][i] || '')}</span></div>`).join('')}</div>
  <p class="grade">총점 <b>?</b> 봉함</p></div><img class="rb" src="img/rod-bot.webp" alt=""></div>
  <div class="card"><h2><img src="img/icon-scale.webp" alt="">열 가지 잣대</h2><p class="note" style="margin-top:-4px">셋은 먼저 펼쳐 드리고, 일곱은 봉해 두었습니다.</p><div class="chk10">${v.checks.map(c => c.sealed ? `<div class="sealed"><img src="img/icon-${c.icon}.webp" alt=""><b><small>${c.no}</small>${esc(c.title)}</b><em aria-label="봉함">封</em></div>` : ckHTML(c)).join('')}<div class="sealed"><img src="img/icon-roots.webp" alt=""><b>이름이 더해진 팔자</b><em aria-label="봉함">封</em></div><div class="sealed"><img src="img/icon-sieve.webp" alt=""><b>바꾼다면 어느 쪽으로</b><em aria-label="봉함">封</em></div></div></div>`
  h += priceCard('gamjeong') + miniLinks
 } else {
  h += `<div class="pageh"><h1>${esc(o.sur)}씨 ${k === 'baby' ? '아기' : '새'} 이름 열 개를<br>봉해 두었습니다</h1><p>${esc(whenText(o, v.saju))}</p></div>`
  h += sajuCard(v.saju)
  h += `<div class="card"><h2><img src="img/icon-sieve.webp" alt="">체로 거른 수</h2><div class="sieve">${funnelRows(v.funnel, '남은 이름')}</div><p class="note" style="margin-top:8px">남은 이름 가운데 점수가 높은 열 개를 봉했고, 결제하면 다음 열 개까지 스무 개를 펼칩니다.</p></div>`
  if (v.current) h += `<div class="card"><h2><img src="img/icon-tags.webp" alt="">지금 이름</h2><p><b style="font-size:20px">${esc(v.current.fullHj)}</b> ${esc(v.current.full)} — 등급 <b style="color:var(--red)">${esc(v.current.grade)}(${esc(v.current.gradeKo)})</b></p><p class="note">어느 잣대에서 깎였는지는 결제 뒤 펼쳐 드립니다.</p></div>`
  h += `<div class="card"><h2><img src="img/seal-empty.webp" alt="">봉한 이름</h2><div class="envs">${v.sealed.map((x, i) => `<div class="env"><img src="img/env.webp" alt=""><div class="l"><b>${ORD[i]} 이름</b>${esc(o.sur)}○○</div><div class="r"><b>${x.total}점</b>${esc(x.grade)}${msealHTML(i === 0 ? ['薦', ...x.seals] : x.seals)}</div></div>`).join('')}</div></div>`
  h += priceCard(k) + miniLinks
 }
 $('#freeBody').innerHTML = h
 $('#payBtn').addEventListener('click', pay)
 payNote()
}

/* ───────── 잣대 하나 ───────── */
const lvl = s => s >= 9.5 ? 5 : s >= 8 ? 4 : s >= 6.5 ? 3 : s >= 4.5 ? 2 : 1
function ckHTML(c) {
 const L = lvl(c.score)
 return `<div class="ck"><div class="t"><img src="img/icon-${c.icon}.webp" alt=""><b><small>${c.no}</small>${esc(c.title)}</b><span class="sc">${Number(c.score).toFixed(c.score % 1 ? 1 : 0)}</span></div>
 <div class="bar"><img src="img/gauge-${L}.webp" alt="" style="width:${L * 20}%"></div><p class="v">${esc(c.verdict)}</p><ul>${c.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`
}

/* ───────── 바꾼다면 어느 쪽으로 ───────── */
function guideHTML(g, n, withCta = true) {
 return `<div class="card guide"><h2><img src="img/icon-sieve.webp" alt="">바꾼다면 어느 쪽으로</h2><p class="v2">${esc(g.verdict)}</p>
  ${g.lines.map(l => `<p>${esc(l)}</p>`).join('')}
  ${g.need.map(nd => `<p class="pk-h">${esc(nd.ko)} 기운 글자 보기</p><div class="exs">${nd.ex.map(x => `<span><b>${esc(x.h)}</b>${esc(x.eum)} · ${esc(x.k)}</span>`).join('')}</div>`).join('')}
  ${withCta && g.samples && g.samples.length ? `<p class="pk-h">같은 생년월일로 지은 개명 이름 맨 위 셋</p><div class="samples">${g.samples.map(x => `<div><b>${esc(x.full)}</b><span>${x.total}점 · ${esc(x.grade)}</span><em>한자 封</em></div>`).join('')}</div>
  <p class="note">한자와 열 잣대 풀이, 나머지 열일곱 이름은 ‘개명할 이름 짓기’에서 펼칩니다. 넣으신 성·생년월일·지금 이름을 그대로 옮겨 드립니다.</p>
  <button class="cta" type="button" id="toRename"><span class="dbtn">개명할 이름 짓기 · <span data-price="rename">${won(PRICE.rename)}원</span></span></button>` : ''}</div>`
}

/* ───────── 결제한 결과 ───────── */
const HN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十']
const meanLine = x => x.chars.map(c => c.k || (c.hun && c.hun[0]) || '').join(' · ')
/* 이름 한 장 — 한지 명첩. 순위는 주묵 낙관, 한자는 원상 안에 세로로 */
function cardHTML(x, i, pickable = true, feat = false) {
 const on = S.picks.includes(x)
 const seals = (x.rank === 1 ? ['薦', ...x.seals] : x.seals).filter(s => !(feat && s === '薦'))
 return `<article class="nc${feat ? ' feat' : ''}"><button type="button" class="nc-open" data-i="${i}" aria-label="${esc(x.full)} ${x.total}점 풀이 펼치기">
  ${x.rank ? `<span class="rk" aria-hidden="true">${HN[x.rank] || x.rank}</span>` : ''}
  <span class="sq"><img class="enso" src="img/enso.webp" alt="" aria-hidden="true">${[...x.givenHj].map(c => `<b>${esc(c)}</b>`).join('')}</span>
  <span class="info">${feat ? `<span class="cheon"><img src="img/seal-cheon.webp" alt="薦">묵산이 첫째로 천거</span>` : ''}
   <span class="ko">${esc(x.full)}</span><span class="rule" aria-hidden="true"></span>
   <span class="sc"><b>${x.total}</b>점 · ${esc(x.grade)}</span>
   ${seals.length ? `<span class="ms">${seals.map(s => `<img src="img/${SEALIMG[s][0]}.webp" alt="${s}" title="${SEALIMG[s][1]}">`).join('')}</span>` : ''}
   <span class="kk">${esc(meanLine(x))}</span>
   <span class="go" aria-hidden="true">풀이 펼치기</span></span></button>
  ${pickable ? `<button type="button" class="pick" data-pick="${i}" aria-pressed="${on}">${on ? '견주기에 담음' : '견주기에 담기'}</button>` : ''}</article>`
}
function renderFull() {
 const v = S.full, o = S.input, k = v.kind
 let h = ''
 if (k === 'gamjeong') {
  const n = v.name
  h += `<div class="pageh"><h1>${esc(n.full)} — 이름 감정</h1><p>${esc(whenText(o, v.saju))}</p></div>
  <div class="scroll"><img class="rt" src="img/rod-top.webp" alt=""><div class="body"><div class="vname">${[...n.fullHj].map((c, i) => `<div><b>${esc(c)}</b><span>${esc([...n.full][i] || '')}</span></div>`).join('')}</div>
  <p class="grade">총점 <b>${n.total}</b>점 · ${esc(n.grade)}(${esc(n.gradeKo)})</p>${sealsFig(n)}</div><img class="rb" src="img/rod-bot.webp" alt=""></div>`
  h += detailCards(n, v.saju)
  if (v.guide) h += guideHTML(v.guide, n)
  if (v.better && v.better.length) h += `<div class="card"><h2><img src="img/icon-book.webp" alt="">같은 소리, 더 나은 한자</h2><p class="note">‘${esc(n.given)}’ 소리는 그대로 두고 한자만 바꾸면 점수가 오르는 짝입니다. 눌러서 자세히 보십시오.</p><div class="names" style="margin:10px 0 0">${v.better.map((x, i) => cardHTML(x, 'b' + i, false)).join('')}</div></div>`
  h += `<button class="cta" type="button" id="toCert" style="margin-top:22px"><span class="dbtn">감명장 받기</span></button>`
  h += sajuCard(v.saju) + miniLinks
 } else {
  const list = v.list, page = list.slice(S.page * 10, S.page * 10 + 10)
  h += `<div class="pageh"><h1>${esc(o.sur)}씨 ${k === 'baby' ? '아기' : '새'} 이름 스무 개</h1><p>${S.page ? '열하나째부터 스무째까지' : '첫째부터 열째까지'} · 이름을 누르면 열 잣대 풀이가 펼쳐집니다</p></div>`
  if (v.current) h += `<div class="card"><h2><img src="img/icon-tags.webp" alt="">지금 이름 — ${esc(v.current.fullHj)} ${esc(v.current.full)}</h2><p>총점 <b style="color:var(--red);font-size:20px">${v.current.total}</b>점 · ${esc(v.current.grade)}(${esc(v.current.gradeKo)})</p><p class="note">가장 많이 깎인 잣대: ${esc(v.current.checks.slice().sort((a, b) => a.score - b.score).slice(0, 2).map(c => c.title + ' ' + c.score).join(' · '))}</p><button type="button" class="more" data-cur>지금 이름 자세히 보기</button></div>` + (v.current.guide ? guideHTML(v.current.guide, v.current, false) : '')
  if (list.some(x => x.relaxed)) h += `<p class="mini" style="margin:12px 18px 0;text-align:left">돌림자 ‘${esc(o.dolKo || '')}’가 성과 소리가 부딪쳐, 엄한 잣대를 다 넘는 이름이 스물이 안 됩니다. 소리 오행을 점수로만 보고 사격 넷 가운데 셋이 길한 이름으로 나머지를 채웠습니다(점수에 그대로 드러납니다).</p>`
  if (!list.length) h += `<div class="card"><p>넣으신 돌림자로는 쓸 만한 이름을 찾지 못했습니다. 돌림자 자리(앞·뒤)를 바꾸거나 돌림자 없이 다시 지어 보십시오. 결제한 풀이는 이 기기에서 30일 동안 다시 열립니다.</p></div>`
  h += `<div class="names">${page.map((x, j) => cardHTML(x, S.page * 10 + j, true, x.rank === 1)).join('')}</div>`
  h += `<div class="btns"><button type="button" id="again"><img src="img/bl-again.webp" alt="${S.page ? '앞의 열 개 보기' : '다음 열 개 보기'}"></button><button type="button" id="cmp"${S.picks.length < 2 ? ' aria-disabled="true" style="opacity:.5"' : ''}><img src="img/bl-compare.webp" alt="나란히 견주기"></button></div>`
  h += `<p class="mini" style="margin-top:8px">${S.page ? '‘다시 뽑기’를 누르면 앞의 열 개로 돌아갑니다.' : '‘다시 뽑기’를 누르면 다음 열 개를 펼칩니다.'} ‘견주기에 담기’로 둘이나 셋을 담으면 나란히 견줄 수 있습니다.</p>`
  h += sajuCard(v.saju)
  if (k === 'rename') h += `<div class="card"><h2><img src="img/icon-sieve.webp" alt="">개명은 이렇게 합니다</h2><p>① 주소지를 맡은 가정법원(지원)에 개명허가 신청서를 냅니다. 새 이름의 한글과 한자를 함께 적고, 바꾸려는 까닭을 밝힙니다.</p><p>② 법원이 허가하면 허가서 등본을 받은 날부터 한 달 안에 시·구·읍·면 사무소에 개명신고를 합니다.</p><p>③ 신고가 끝나면 주민등록·여권·은행·보험 등의 이름을 차례로 바꿉니다.</p><p class="note">2024년 한 해 개명 허가는 8만 4천여 건이었습니다. 허가 여부와 걸리는 기간은 법원이 정합니다.</p></div>`
  h += miniLinks
 }
 $('#fullBody').innerHTML = h
 bindFull()
}
function bindFull() {
 const v = S.full
 const at = i => String(i).startsWith('b') ? v.better[+String(i).slice(1)] : v.list[+i]
 $$('#fullBody .nc-open').forEach(b => b.addEventListener('click', () => openSheet(at(b.dataset.i))))
 $$('#fullBody .pick').forEach(b => b.addEventListener('click', () => {
  const x = at(b.dataset.pick), on = S.picks.includes(x)
  if (!on && S.picks.length >= 3) return toast('견주기는 셋까지 담을 수 있습니다')
  S.picks = on ? S.picks.filter(y => y !== x) : [...S.picks, x]
  toast(on ? `${x.full} 뺐습니다` : `${x.full} 담았습니다 (${S.picks.length}/3)`, 1600)
  // 다시 그리지 않고 단추만 바꾼다 — 보던 자리가 튀지 않게
  b.setAttribute('aria-pressed', String(!on)); b.textContent = on ? '견주기에 담기' : '견주기에 담음'
  const cm = $('#cmp'); if (cm) { const ok = S.picks.length >= 2; if (ok) cm.removeAttribute('aria-disabled'); else cm.setAttribute('aria-disabled', 'true'); cm.style.opacity = ok ? '' : '.5' }
 }))
 const cur = $('[data-cur]'); cur && cur.addEventListener('click', () => openSheet(v.current))
 const ag = $('#again'); ag && ag.addEventListener('click', () => { S.page = S.page ? 0 : 1; renderFull(); window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }) })
 const cm = $('#cmp'); cm && cm.addEventListener('click', () => { if (S.picks.length < 2) return toast('‘견주기에 담기’를 눌러 이름을 둘 이상 담아 주십시오'); renderCmp(); show('cmp') })
 const tc = $('#toCert'); tc && tc.addEventListener('click', () => openCert(v.name, 'gam'))
 const tr = $('#toRename'); tr && tr.addEventListener('click', () => prefillRename(S.input))
}
function sealsFig(x, top) {
 const s = top ? ['薦', ...x.seals] : x.seals
 return s.length ? `<div class="seals">${s.map(k => `<figure><img src="img/${SEALIMG[k][0]}.webp" alt="${k}"><figcaption>${SEALIMG[k][1]}</figcaption></figure>`).join('')}</div>` : ''
}
const RELIMG = { gen: ['arrow-gen', '살려 줌'], genr: ['arrow-gen', '살려 줌'], same: ['arrow-same', '같은 기운'], ctl: ['arrow-ctl', '부딪침'] }
function flowHTML(names, seq, pairs) {
 let h = '<div class="flow">'
 seq.forEach((e, i) => {
  h += `<div class="el"><img src="img/el-${EL[e] || 'to'}.webp" alt="${ELKO[e] || ''}"><span>${esc(names[i])} ${ELKO[e] || ''}</span></div>`
  if (i < pairs.length) { const r = RELIMG[pairs[i]]; h += `<div class="ar"><img src="img/${r[0]}.webp" alt=""><span>${r[1]}</span></div>` }
 })
 return h + '</div>'
}
function paljaHTML(pj, sj) {
 const row = (lab, cnt) => `<div class="pjrow"><span class="pjl">${lab}</span>${Object.keys(EL).map(e => `<div class="${sj && e === sj.yong ? 'need' : ''} ${cnt[e] ? '' : 'zero'}"><img src="img/el-${EL[e]}.webp" alt="${ELKO[e]}"><b>${cnt[e]}</b></div>`).join('')}</div>`
 return `<div class="card"><h2><img src="img/icon-roots.webp" alt="">이름이 더해진 팔자</h2><p class="note" style="margin-top:-4px">사주 여덟 글자의 다섯 기운에 이름 글자의 뿌리 기운을 더해 봤습니다.</p>${row('사주만', pj.before)}${row('이름 더하면', pj.after)}${pj.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>`
}
function storyHTML(x) {
 return x.story ? `<div class="card story"><h2><img src="img/icon-book.webp" alt="">한눈 풀이</h2>${x.story.map((l, i) => `<p${i === x.story.length - 1 ? ' class="last"' : ''}>${esc(l)}</p>`).join('')}</div>` : ''
}
function detailCards(x, sj) {
 const ck = Object.fromEntries(x.checks.map(c => [c.key, c]))
 const WX = [0.8, 25.8, 50.2, 74.6]
 let h = ''
 if (ck.뜻 && ck.뜻.join) h += `<p class="join">${esc(ck.뜻.join)}</p>`
 h += storyHTML(x)
 if (x.palja) h += paljaHTML(x.palja, sj)
 h += `<div class="card"><h2><img src="img/icon-rods.webp" alt="">원형이정 — 수리 사격</h2><div class="wh"><img src="img/wonhyeong.webp" alt="元亨利貞">${x.sagyeok.map((g, i) => `<div class="bx ${g.gil ? 'gil' : 'hyung'}" style="left:${WX[i]}%;width:24.4%"><b>${g.n}</b><span>${esc(g.nm)} · ${g.gil ? '길' : '흉'}</span></div>`).join('')}</div>
  ${x.sagyeok.map(g => `<p><b>${['어린 시절', '젊은 날', '한창때', '평생 전체'][['元', '亨', '利', '貞'].indexOf(g.k)]}</b> · ${g.ko} ${g.n}수 ${g.gil ? '좋음' : '<b style="color:var(--red)">나쁨</b>'} — ${esc(g.t)} <span class="note">${esc(g.age)}</span></p>`).join('')}
  <p class="note">성 ${esc(x.surHj)} ${x.surWon}획 · ${x.chars.map(c => `${esc(c.h)} ${c.won}획`).join(' · ')} (원획)</p></div>`
 const root = ck.뿌리, snd = ck.소리
 const nm = [x.surHj.slice(-1), ...x.chars.map(c => c.h)]
 h += `<div class="card"><h2><img src="img/icon-roots.webp" alt="">오행 흐름</h2><p class="flow-h">글자 뿌리(자원오행)</p>${flowHTML(nm, root.seq, root.flow)}`
 if (snd && snd.per) {
  const syl = [x.sur.slice(-1), ...[...x.given]]
  h += `<p class="flow-h">소리 — 요즘 다수 학설</p>${flowHTML(syl, snd.per.운해.seq, snd.per.운해.pairs)}<p class="flow-h">소리 — 훈민정음 해례본</p>${flowHTML(syl, snd.per.해례.seq, snd.per.해례.pairs)}`
 }
 h += `</div><div class="card"><h2><img src="img/icon-scale.webp" alt="">열 가지 잣대</h2><div class="chk10">${x.checks.map(ckHTML).join('')}</div></div>`
 return h
}
let sheetX = null
function openSheet(x) {
 sheetX = x
 const isTop = x.rank === 1
 $('#sheetBody').innerHTML = `<div class="plate"><img src="img/plate-gold.webp" alt=""><span class="pseal" aria-hidden="true"></span><div class="tx"><b>${esc(x.fullHj)}</b><span>${esc(x.full)}</span></div></div>
  <div class="score"><b>${x.total}</b><span>점 · ${esc(x.grade)}(${esc(x.gradeKo)})${x.rank ? ` · ${x.rank}위` : ''}</span></div>${sealsFig(x, isTop)}
  ${detailCards(x, S.full.saju)}
  <button class="cta" type="button" id="sheetCert"><img src="img/bd-cert.webp" alt="성명장 받기"></button>`
 $('#sheet').classList.add('on'); $('#sheet').scrollTop = 0; document.body.style.overflow = 'hidden'
 history.pushState({ s: cur, sheet: 1 }, '')
 $('#sheetCert').addEventListener('click', () => { const k = S.full.kind === 'gamjeong' ? 'gam' : 'seong'; closeSheet(); openCert(x, k) })
}
function closeSheet(fromPop) {
 if (!$('#sheet').classList.contains('on')) return
 $('#sheet').classList.remove('on'); document.body.style.overflow = ''
 if (!fromPop && history.state && history.state.sheet) history.back()
}
$('#sheetX').addEventListener('click', () => closeSheet())
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet() })

/* ───────── 견주기 ───────── */
function renderCmp() {
 const P = S.picks, n = P.length
 const row = (label, f, best) => {
  const vals = P.map(f), nums = vals.map(v => typeof v === 'number' ? v : null)
  const nn = nums.filter(v => v != null), mx = best && nn.length && nn.some(v => v !== nn[0]) ? Math.max(...nn) : null // 모두 같으면 붉게 하지 않는다
  return `<tr><th>${label}</th>${vals.map(v => `<td class="${best && v === mx ? 'best' : ''}">${typeof v === 'number' ? (v % 1 ? v.toFixed(1) : v) : esc(v)}</td>`).join('')}</tr>`
 }
 const C = x => Object.fromEntries(x.checks.map(c => [c.key, c]))
 $('#cmpBody').innerHTML = `<div class="pageh"><h1>나란히 견주기</h1><p>담은 이름 ${n}개 · 붉은 글자가 그 줄에서 앞서는 쪽입니다</p></div>
  <div class="cmp" style="--n:${n}">${P.map(x => cardHTML(x, -1, false)).join('')}</div>
  <div class="cmpt"><table>
   ${row('총점', x => x.total, 1)}${row('등급', x => x.grade)}
   ${['사주', '뿌리', '수리', '음양', '소리', '부름', '뜻', '흔함', '놀림'].map(k => row(C(P[0])[k].title, x => C(x)[k].score, 1)).join('')}
   ${row('원·형·이·정', x => x.sagyeok.map(g => g.n).join(' · '))}
   ${row('담은 뜻', x => x.chars.map(c => c.k || (c.hun && c.hun[0])).join(' · '))}
   ${row('채운 기운', x => x.chars.map(c => ELKO[c.el]).join(' · '))}
  </table></div>
  <p class="mini">견준 이름을 누르면 풀이가 펼쳐집니다.</p>`
 $$('#cmpBody .nc-open').forEach((b, i) => b.addEventListener('click', () => openSheet(P[i])))
}

/* ───────── 성명장 · 감명장 ───────── */
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
function wrapLines(ctx, text, maxW) {
 const out = []; let line = ''
 for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w } else line = t }
 if (line) out.push(line); return out
}
async function drawCert(x, kind) {
 const o = S.input, sj = S.full.saju
 const bg = await loadImg(kind === 'gam' ? 'img/cert-gam.webp' : 'img/cert-seong.webp')
 const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1536
 const c = cv.getContext('2d'); c.drawImage(bg, 0, 0, 1024, 1536)
 const FF = '"MSerif","Noto Serif KR",serif'
 const allText = x.fullHj + x.full + '0123456789年月日時점격길흉수뜻채운기운태어난날사주총점등급원형이정음양력윤달시모름' + x.checks.map(k => k.title + k.verdict).join('')
 try { await Promise.all([document.fonts.load(`700 150px ${FF}`, allText), document.fonts.load(`500 32px ${FF}`, allText)]) } catch (e) {}
 c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#1e1915'
 const hj = [...x.fullHj], ko = [...x.full], gap = hj.length > 3 ? 170 : 200
 c.font = `700 148px ${FF}`; hj.forEach((ch, i) => c.fillText(ch, 512 + (i - (hj.length - 1) / 2) * gap, 440))
 c.font = `700 52px ${FF}`; c.fillStyle = '#4b433a'; ko.forEach((ch, i) => c.fillText(ch, 512 + (i - (ko.length - 1) / 2) * gap, 530))
 c.strokeStyle = 'rgba(169,50,34,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(200, 580); c.lineTo(824, 580); c.stroke()
 const when = whenText(o, sj).replace(/ · (남자|여자)$/, '')
 const pil = sj.cols.slice().reverse().map((p, i) => p ? p.s + p.b + ['年', '月', '日', '時'][i] : '').filter(Boolean).join(' ')
 const rows = kind === 'gam'
  ? [['태어난 날', when], ['사주', pil], ['총점', `${x.total}점 · ${x.grade}(${x.gradeKo})`], ['원형이정', x.sagyeok.map(g => `${g.k}${g.n}`).join(' ') + ' — ' + (x.sagyeok.every(g => g.gil) ? '네 격 모두 길' : `흉한 격 ${x.sagyeok.filter(g => !g.gil).length}`)]]
  : [['태어난 날', when], ['사주', pil], ['채운 기운', `${ELKO[sj.yong]}(${sj.yong}) — ` + x.chars.map(k => `${k.h} ${ELKO[k.el]}`).join(' · ')], ['원형이정', x.sagyeok.map(g => `${g.k}${g.n} ${g.nm.replace('格', '')}`).join(' · ')], ['뜻', (x.checks.find(k => k.key === '뜻').join || '').replace(/ 이름입니다\.$/, ' 이름')], ['총점', `${x.total}점 · ${x.grade}(${x.gradeKo})`]]
 let y = kind === 'gam' ? 650 : 672, gapL = kind === 'gam' ? 44 : 50, gapR = kind === 'gam' ? 18 : 26; c.textAlign = 'left'
 for (const [k, val] of rows) {
  c.font = `700 32px ${FF}`; c.fillStyle = '#857a6c'; c.fillText(k, 140, y)
  c.font = `500 35px ${FF}`; c.fillStyle = '#1e1915'
  const ls = wrapLines(c, val, 590); ls.forEach((l, i) => c.fillText(l, 310, y + i * gapL)); y += Math.max(1, ls.length) * gapL + gapR
 }
 if (kind === 'gam') {
  y += 14; c.font = `500 30px ${FF}`
  x.checks.forEach((k, i) => { const col = i % 2, r = Math.floor(i / 2); c.fillStyle = '#1e1915'; c.fillText(`${k.title}`, 140 + col * 385, y + r * 46); c.fillStyle = k.score >= 7 ? '#4f6b3a' : '#a93222'; c.textAlign = 'right'; c.fillText(String(k.score), 495 + col * 385, y + r * 46); c.textAlign = 'left' })
 }
 const t = new Date(), today = `${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일`
 c.textAlign = 'center'; c.font = `500 30px ${FF}`; c.fillStyle = '#4b433a'; c.fillText(`${today} ${kind === 'gam' ? '재어 드림' : '지어 드림'}`, 512, 1250)
 return cv.toDataURL('image/png')
}
/* 풀이첩 — 성명장 뒤에 붙는 긴 그림. 그 이름의 팔자와 풀이를 모두 담아 사진첩에 남게 한다 */
async function drawBook(x, kind) {
 const o = S.input, sj = S.full.saju, W = 1024, FF = '"MSerif","Noto Serif KR",serif'
 const [hanji, logo, seal, ...els] = await Promise.all(['img/hanji.webp', 'img/logo.webp', 'img/seal-muk.webp', ...Object.keys(EL).map(e => `img/el-${EL[e]}.webp`)].map(loadImg))
 const story = x.story || [], pj = x.palja, guide = kind === 'gam' ? S.full.guide : (x.guide || null)
 const all = x.fullHj + x.full + story.join('') + (pj ? pj.lines.join('') : '') + x.checks.map(k => k.title + k.verdict).join('') + (guide ? guide.verdict + guide.lines.join('') : '') + '이름풀이첩타고난사주네시기운열가지잣대한눈더해진팔자바꾼다면어느쪽으로0123456789年月日時점'
 try { await Promise.all([document.fonts.load(`700 40px ${FF}`, all), document.fonts.load(`500 30px ${FF}`, all)]) } catch (e) {}
 const cv = document.createElement('canvas'); cv.width = W; cv.height = 7000
 const c = cv.getContext('2d')
 c.fillStyle = c.createPattern(hanji, 'repeat'); c.fillRect(0, 0, W, 7000)
 const L = 84, R = W - 84, TW = R - L
 let y = 70
 c.drawImage(logo, W / 2 - 170, y, 340, 340 * logo.height / logo.width); y += 340 * logo.height / logo.width + 50
 c.textAlign = 'center'; c.fillStyle = '#857a6c'; c.font = `500 32px ${FF}`; c.fillText(kind === 'gam' ? '이름 감정 풀이첩' : '이름 풀이첩', W / 2, y); y += 150
 c.fillStyle = '#1e1915'; c.font = `700 112px ${FF}`; c.fillText([...x.fullHj].join(' '), W / 2, y); y += 66
 c.font = `700 44px ${FF}`; c.fillStyle = '#4b433a'; c.fillText([...x.full].join('  '), W / 2, y); y += 66
 c.font = `700 40px ${FF}`; c.fillStyle = '#a93222'; c.fillText(`${x.total}점 · ${x.grade}(${x.gradeKo})`, W / 2, y); y += 40
 const head = t => { y += 56; c.textAlign = 'left'; c.fillStyle = '#a93222'; c.fillRect(L, y - 30, 8, 36); c.fillStyle = '#1e1915'; c.font = `700 38px ${FF}`; c.fillText(t, L + 24, y); y += 22; c.strokeStyle = 'rgba(60,45,30,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); y += 44 }
 const para = (t, size = 35, color = '#1e1915', gap = 54, bold = false) => { c.textAlign = 'left'; c.font = `${bold ? 700 : 500} ${size}px ${FF}`; c.fillStyle = color; for (const l of wrapLines(c, t, TW)) { c.fillText(l, L, y); y += gap } y += 10 }
 // 타고난 사주
 head('타고난 사주')
 para(whenText(o, sj), 32, '#4b433a', 48)
 const cw = TW / 4, cols = ['시주', '일주', '월주', '년주']
 c.strokeStyle = 'rgba(30,25,21,.55)'; c.lineWidth = 2; c.strokeRect(L, y, TW, 280)
 sj.cols.forEach((p, i) => {
  const cx = L + cw * i + cw / 2; if (i) { c.beginPath(); c.moveTo(L + cw * i, y); c.lineTo(L + cw * i, y + 280); c.stroke() }
  c.textAlign = 'center'; c.fillStyle = '#857a6c'; c.font = `500 24px ${FF}`; c.fillText(cols[i], cx, y + 36)
  c.fillStyle = i === 1 ? '#a93222' : '#1e1915'; c.font = `700 72px ${FF}`; c.fillText(p ? p.s : '?', cx, y + 120); c.fillStyle = '#1e1915'; c.fillText(p ? p.b : '?', cx, y + 210)
  c.fillStyle = '#857a6c'; c.font = `500 22px ${FF}`; c.fillText(p ? `${p.sk}${p.bk} · ${ELKO[p.se]}·${ELKO[p.be]}` : '모름', cx, y + 262)
 })
 y += 326
 for (const l of (sj.lines || [])) para(l)
 // 이름이 더해진 팔자
 if (pj) {
  head('이름이 더해진 팔자')
  const row = (lab, cnt) => { c.textAlign = 'left'; c.fillStyle = '#4b433a'; c.font = `700 28px ${FF}`; c.fillText(lab, L, y + 52); Object.keys(EL).forEach((e, i) => { const cx = L + 200 + i * ((TW - 200) / 5); c.drawImage(els[i], cx, y, 70, 72); c.fillStyle = cnt[e] ? '#1e1915' : '#857a6c'; c.font = `700 40px ${FF}`; c.textAlign = 'left'; c.fillText(String(cnt[e]), cx + 84, y + 52) }); y += 96 }
  row('사주만', pj.before); row('이름 더하면', pj.after); y += 34
  for (const l of pj.lines) para(l)
 }
 // 한눈 풀이
 head('한눈 풀이')
 story.forEach((l, i) => para(l, 35, i === story.length - 1 ? '#a93222' : '#1e1915', 54, i === story.length - 1))
 // 네 시기 운
 head('획수로 보는 네 시기 운')
 const AGE = ['어린 시절', '젊은 날', '한창때', '평생 전체']
 x.sagyeok.forEach((g, i) => para(`${AGE[i]} · ${g.ko} ${g.n}수 ${g.gil ? '좋음' : '나쁨'} — ${g.t}`, 35, g.gil ? '#1e1915' : '#a93222', 54))
 // 열 가지 잣대
 head('열 가지 잣대')
 x.checks.forEach(k => {
  c.textAlign = 'left'; c.font = `700 35px ${FF}`; c.fillStyle = '#1e1915'; c.fillText(`${k.no}. ${k.title}`, L, y)
  c.textAlign = 'right'; c.fillStyle = k.score >= 7 ? '#4f6b3a' : '#a93222'; c.fillText(String(k.score), R, y); y += 50
  para(k.verdict, 32, '#4b433a', 48)
 })
 if (guide) { head('바꾼다면 어느 쪽으로'); para(guide.verdict, 35, '#a93222', 54, true); guide.lines.forEach(l => para(l)) }
 // 맺음
 y += 40; c.textAlign = 'center'; c.fillStyle = '#4b433a'; c.font = `500 28px ${FF}`
 const t = new Date(); c.fillText(`${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일 · 墨山作名院`, W / 2 - 40, y + 50)
 c.drawImage(seal, W / 2 + 230, y - 10, 92, 92 * seal.height / seal.width); y += 150
 // 테두리
 const H = Math.ceil(y + 40), out = document.createElement('canvas'); out.width = W; out.height = H
 const o2 = out.getContext('2d'); o2.drawImage(cv, 0, 0)
 o2.strokeStyle = '#a3843f'; o2.lineWidth = 3; o2.strokeRect(26, 26, W - 52, H - 52); o2.lineWidth = 1.5; o2.strokeRect(38, 38, W - 76, H - 76)
 return out.toDataURL('image/png')
}
let certURL = '', certName = '', bookURL = '', bookName = ''
async function openCert(x, kind) {
 toast('먹을 묻혀 쓰는 중입니다', 1500)
 try { certURL = await drawCert(x, kind); bookURL = await drawBook(x, kind) } catch (e) { console.error(e); return toast('성명장을 그리지 못했습니다. 다시 눌러 주십시오') }
 const nm = kind === 'gam' ? '감명장' : '성명장'
 certName = `묵산작명원-${nm}-${x.full}.png`; bookName = `묵산작명원-풀이첩-${x.full}.png`
 $('#certImg').src = certURL; $('#certImg').alt = `${nm} ${x.fullHj} ${x.full}`
 $('#bookImg').src = bookURL; $('#bookImg').alt = `풀이첩 ${x.fullHj} ${x.full}`
 $('#certH').textContent = nm
 show('cert')
}
const saveImg = (url, name) => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('저장이 안 되면 그림을 길게 눌러 저장하십시오', 3200) }
$('#certSave').addEventListener('click', () => saveImg(certURL, certName))
$('#bookSave').addEventListener('click', () => saveImg(bookURL, bookName))
$('#certPrint').addEventListener('click', () => window.print())

/* ───────── 결제 ───────── */
const payNote = () => {
 const e = $('#paynote'); if (!e) return
 const t = PAYCFG.mode === 'owner' ? '주인 열람 · 결제 없이 펼쳐집니다' : PAYCFG.mode === 'toss' ? (PAYCFG.live ? '' : '시험 결제창 · 실제로 돈이 나가지 않습니다') : PAYCFG.mode === 'closed' ? '결제 창구 점검 중입니다' : '데모판 · 실제 결제 없이 펼쳐집니다'
 e.textContent = t; e.hidden = !t
}
const loadPayCfg = () => fetch('api/order' + (WANT_TOSS ? '?pay=toss' : ''), { cache: 'no-store' }).then(r => r.json()).then(j => { if (j && j.ok) { PAYCFG = j; PRICE = j.price || PRICE } payNote(); return PAYCFG }).catch(() => PAYCFG)
let payCfgP = loadPayCfg()
const why = e => { if (!e) return 'UNKNOWN'; const n = e.name && e.name !== 'Error' && e.name !== 'TypeError' ? e.name : ''; return String(e.code || n || e.message || 'UNKNOWN').slice(0, 60) }
const loadToss = () => new Promise((ok, no) => { if (window.TossPayments) return ok(window.TossPayments); const sc = document.createElement('script'); sc.src = 'https://js.tosspayments.com/v2/standard'; sc.onload = () => window.TossPayments ? ok(window.TossPayments) : no(new Error('toss')); sc.onerror = () => no(new Error('TOSS_SDK')); document.head.appendChild(sc) })
let paying = false, payWin = null
async function paidOK(r) { S.full = r.eng; S.page = 0; S.picks = []; renderFull(); show('full', 'replace') }
async function pay() {
 if (paying) return; paying = true
 const btn = $('#payBtn'); btn && (btn.disabled = true)
 try {
  await payCfgP
  const rs = await post('api/order', { action: 'restore', input: S.input }).catch(() => null)
  if (rs && rs.ok) { toast('이미 결제한 풀이입니다 · 다시 결제하지 않고 열어 드립니다'); return paidOK(rs) }
  const c = await post('api/order', { action: 'create', input: S.input, from: FROM, test: WANT_TOSS })
  if (!c || !c.ok) return toast(c && c.message || '결제를 시작하지 못했습니다. 다시 눌러 주십시오')
  if (c.mode === 'toss') {
   SS.set('msPend', { orderId: c.orderId, ticket: c.ticket, input: S.input, at: Date.now() })
   const TP = await loadToss(), widgets = TP(c.clientKey).widgets({ customerKey: TP.ANONYMOUS || 'ANONYMOUS' })
   await widgets.setAmount({ value: c.amount, currency: 'KRW' })
   const back = location.origin + location.pathname + '?' + (WANT_TOSS ? 'pay=toss&' : '')
   try { payWin && payWin.destroy && payWin.destroy() } catch (e) {} payWin = null
   const win = await widgets.renderPaymentWindow({ orderName: c.orderName }); payWin = win
   win.on('cancel', () => { payWin = null; SS.del('msPend') })
   win.on('paymentRequest', async () => {
    try { await widgets.requestPayment({ orderId: c.orderId, orderName: c.orderName, successUrl: back + 'toss=ok', failUrl: back + 'toss=fail' }) }
    catch (e) { SS.del('msPend'); const k = why(e); console.error('[결제]', k, e); toast(/취소|CANCEL/i.test(k) ? '결제를 취소했습니다. 돈은 빠져나가지 않았습니다' : '결제를 마치지 못했습니다. 돈은 빠져나가지 않았습니다 (' + k + ')') }
   })
   return
  }
  if (c.mode === 'demo') toast('데모판이라 결제 없이 펼칩니다', 1800)
  const r = await grind(S.input.kind, post('api/order', { action: 'confirm', orderId: c.orderId, paymentKey: (c.mode === 'owner' ? 'owner_' : 'demo_') + c.orderId, amount: c.amount, ticket: c.ticket, input: S.input, from: FROM }))
  if (!r || !r.ok) { history.back(); return toast(r && r.message || '풀이를 펼치지 못했습니다. 다시 눌러 주십시오') }
  await paidOK(r)
 } catch (e) { SS.del('msPend'); const k = why(e); console.error('[결제]', k, e); toast('결제창을 열지 못했습니다. 돈은 빠져나가지 않았습니다 (' + k + ')') }
 finally { paying = false; btn && (btn.disabled = false) }
}
/* 토스 결제창에서 돌아왔을 때 */
async function tossReturn() {
 const t = Q.get('toss'); if (!t) return false
 const P = SS.get('msPend'); history.replaceState({ s: 'home' }, '', location.pathname + (WANT_TOSS ? '?pay=toss' : ''))
 if (!P || P.orderId !== Q.get('orderId')) return false
 S.input = P.input; S.kind = P.input.kind
 if (t !== 'ok') { SS.del('msPend'); toast((/CANCEL/i.test(Q.get('code') || '') ? '결제를 취소했습니다.' : '결제가 끝나지 않았습니다.') + ' 돈은 빠져나가지 않았습니다'); const f = await post('api/name', { input: S.input }).catch(() => null); if (f && f.ok) { S.free = f.view; renderFree(); show('free') } return true }
 const r = await grind(S.input.kind, post('api/order', { action: 'confirm', orderId: P.orderId, paymentKey: Q.get('paymentKey'), amount: Number(Q.get('amount')), ticket: P.ticket, input: S.input, from: FROM, test: WANT_TOSS }))
 SS.del('msPend')
 if (!r || !r.ok) { show('home', 'replace'); toast((r && r.message || '결제 승인을 마치지 못했습니다') + ' · 승인되지 않은 결제는 돈이 빠져나가지 않습니다', 4200); return true }
 await paidOK(r); return true
}
/* 주인 열쇠: ?주인=… 으로 들어오면 이 기기에 표를 심고 주소에서 지운다 */
async function ownerKey() {
 const v = Q.get('owner') || Q.get('주인'); if (!v) return
 const q = new URLSearchParams(location.search); q.delete('owner'); q.delete('주인')
 history.replaceState({ s: 'home' }, '', location.pathname + (q.toString() ? '?' + q : ''))
 try { const r = await post('api/order', { action: '주인', 값: v }); if (r && r.주인) { payCfgP = loadPayCfg(); toast('주인으로 들어왔습니다 · 결제 없이 펼쳐집니다') } } catch (e) {}
}

/* ───────── 약관 ───────── */
const polOpen = k => { $('#pol').classList.add('on'); $$('.polt button').forEach(b => b.classList.toggle('on', b.dataset.pt === k)); $$('.polb section').forEach(s => s.classList.toggle('on', s.dataset.ps === k)); $('.polb').scrollTop = 0 }
document.addEventListener('click', e => {
 const a = e.target.closest('[data-pol]'); if (a) { e.preventDefault(); if (a.dataset.pol === 'x') $('#pol').classList.remove('on'); else polOpen(a.dataset.pol); return }
 const t = e.target.closest('[data-pt]'); if (t) polOpen(t.dataset.pt)
})
addEventListener('keydown', e => { if (e.key === 'Escape') { $('#pol').classList.remove('on'); closeSheet() } })

ownerKey().then(tossReturn)
})()
