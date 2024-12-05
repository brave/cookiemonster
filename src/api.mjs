// Entrypoint for the API server.

import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import process from 'process'

import './instrument.mjs'
import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'
import * as Sentry from '@sentry/node'
import Router from '@koa/router'
import nunjucks from 'nunjucks'

import { checkPage } from './lib.mjs'
import { getFilteredKnownDevices } from './util.mjs'

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

const version = process.env.GIT_COMMIT ? process.env.GIT_COMMIT.slice(0, 6) : 'unknown'
nunjucks.configure(path.join(import.meta.dirname, 'views'), {
  autoescape: true,
  noCache: version === 'unknown' // assume unknown commit is a development environment
})

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
}, [])

// Create a new router
const router = new Router()

// Define routes
router.get('/', async (ctx) => {
  ctx.body = nunjucks.render('page.html.njk', {
    version
  })
  ctx.response.type = 'html'
})

router.get('/adblock_lists.json', async (ctx) => {
  ctx.body = await fs.readFile(path.join(import.meta.dirname, '..', 'adblock_lists.json'))
  ctx.response.type = 'json'
})

router.get('/proxy_list.json', async (ctx) => {
  ctx.body = proxyList
  ctx.response.type = 'json'
})

const filteredDevices = getFilteredKnownDevices()

router.get('/device_list.json', async (ctx) => {
  ctx.body = filteredDevices
  ctx.response.type = 'json'
})

router.post('/check', async (ctx) => {
  const {
    url,
    seconds,
    adblockLists,
    screenshot,
    location,
    slowCheck,
    device,
    mhtml
  } = ctx.request.body

  // Validate device name
  if (device && !filteredDevices.includes(device)) {
    ctx.status = 400
    ctx.body = { error: 'Bad Request: unknown device' }
    return
  }

  // Ensure location is in the configured proxy list
  if (location && !validProxies.includes(location)) {
    ctx.status = 400
    ctx.body = { error: 'Bad Request: invalid location' }
    return
  }

  const report = await checkPage({
    url,
    seconds: seconds || 4,
    executablePath: browserBinaryPath,
    adblockLists,
    // debugLevel: 'verbose',
    screenshot,
    location,
    slowCheck,
    device,
    mhtml
  })
  ctx.body = JSON.stringify(report)
  ctx.response.type = 'json'
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(port)
