// 내 컴퓨터에서 띄워 보기 — 정적 파일과 api/ 를 버셀처럼 잇는다.  node tests/serve.mjs [포트]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(new URL('..', import.meta.url).pathname)
const port = +process.argv[2] || 4321
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' }
const api = {}
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  const m = u.pathname.match(/^\/api\/([a-z]+)$/)
  if (m) {
    api[m[1]] ||= (await import(path.join(root, 'api', m[1] + '.js'))).default
    let raw = ''; for await (const c of req) raw += c
    req.body = raw ? JSON.parse(raw) : undefined
    return api[m[1]](req, res)
  }
  const f = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname))
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('없음') }
  res.setHeader('Content-Type', T[path.extname(f)] || 'application/octet-stream')
  fs.createReadStream(f).pipe(res)
}).listen(port, () => console.log('http://localhost:' + port))
