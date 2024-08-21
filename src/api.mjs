// Entrypoint for the API server.

import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import process from 'process'

import './instrument.mjs'
import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'
import * as Sentry from '@sentry/node'

import { checkPage } from './lib.mjs'

const browserBinaryPath = process.argv[2] || '/usr/bin/brave'
const port = process.argv[3] || 3000

if (!existsSync(browserBinaryPath)) {
  console.error(`Path ${browserBinaryPath} does not exist.`)
  console.error('Please specify an alternative on the command line.')
  process.exit(-1)
}

console.log(`Browser binary: ${browserBinaryPath}`)
console.log(`Port: ${port}`)

const app = new Koa()
app.use(bodyParser())

Sentry.setupKoaErrorHandler(app)

const proxyList = process.env.PROXY_LIST ? JSON.parse(process.env.PROXY_LIST) : {}
const validProxies = Object.keys(proxyList).reduce((acc, region) => {
  const countries = proxyList[region]
  Object.keys(countries).forEach(country => {
    const cities = countries[country]
    Object.keys(cities).forEach(city => {
      acc.push(cities[city])
    })
  })
  return acc
}, ['direct'])

// TODO: replace with routes
app.use(async ctx => {
  if (ctx.request.path === '/') {
    ctx.body = await fs.readFile(path.join(import.meta.dirname, 'page.html'))
    ctx.response.type = 'html'
  } else if (ctx.request.path === '/adblock_lists.json') {
    ctx.body = await fs.readFile(path.join(import.meta.dirname, '..', 'adblock_lists.json'))
    ctx.response.type = 'json'
  } else if (ctx.request.path === '/proxy_list.json') {
    ctx.body = proxyList
    ctx.response.type = 'json'
  } else if (ctx.request.path === '/check') {
    const { url, seconds, adblockLists, screenshot, location = 'direct' } = ctx.request.body
    // Ensure location is in the configured proxy list
    if (!validProxies.includes(location)) {
      ctx.status = 400
      ctx.body = { error: 'Bad Request: invalid location' }
      return
    }
    const report = await checkPage({
      url,
      seconds: seconds || 4,
      executablePath: browserBinaryPath,
      adblockLists,
      debugLevel: 'verbose',
      location,
      screenshot
    })
    ctx.body = JSON.stringify(report)
    ctx.response.type = 'json'
  }
})

app.listen(port)
