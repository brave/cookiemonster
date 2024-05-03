// Entrypoint for the API server.

import fs from 'fs/promises'
import path from 'path'
import process from 'process'

import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'

import { checkPage } from './lib.mjs'

const browserBinaryPath = process.argv[2] || '/usr/bin/brave'
const port = process.argv[3] || 3000
console.log(`Browser binary: ${browserBinaryPath}`)
console.log(`Port: ${port}`)

const app = new Koa()
app.use(bodyParser())

app.use(async ctx => {
  if (ctx.request.path === '/') {
    ctx.body = await fs.readFile(path.join(import.meta.dirname, 'page.html'))
    ctx.response.type = 'html'
  } else if (ctx.request.path === '/check') {
    const { url, seconds } = ctx.request.body
    const report = await checkPage({
      url,
      seconds: seconds || 4,
      interactive: false,
      executablePath: browserBinaryPath
    })
    ctx.body = JSON.stringify(report)
  }
})

app.listen(port)
