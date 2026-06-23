import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = 5173
const DIST = path.join(__dirname, 'dist')

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
}

http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url)
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html')
  const ext = path.extname(filePath)
  res.setHeader('Content-Type', mime[ext] || 'text/plain')
  fs.createReadStream(filePath).pipe(res)
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Running at http://localhost:${PORT}`)
})
