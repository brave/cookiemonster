'use strict'

import { existsSync, readdirSync, cpSync, mkdirSync, writeFileSync } from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import nodeUrl from 'node:url'
import { setTimeout } from 'node:timers/promises'

import suffixList from '@gorhill/publicsuffixlist'
import rehypeFormat from 'rehype-format'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import * as Sentry from '@sentry/node'

import OpenAI from 'openai'
import proxyChain from 'proxy-chain'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { KnownDevices } from 'puppeteer-core'

import { puppeteerConfigForArgs } from './puppeteer.mjs'
import { inPageRoutine } from './inpage.mjs'
import { templateProfilePathForArgs, parseListCatalogComponentIds, isValidChromeComponentId, isKeeplistedComponentId, getExtensionVersion, getOptionalDefaultComponentIds, replaceVersion, toggleAdblocklists, proxyUrlWithAuth, checkAllComponentsRegistered } from './util.mjs'

// Generate a random string between [a000000000, zzzzzzzzzz] (base 36)
const generateRandomToken = () => {
  const min = Number.parseInt('a000000000', 36)
  const max = Number.parseInt('zzzzzzzzzz', 36)
  return Math.floor(Math.random() * (max - min) + min).toString(36)
}

const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama'
})

const MAX_LENGTH = 500

const keywordClassifierFallback = (innerText) => {
  const keywords = [
    'cookies',
    'consent',
    'privacy',
    'analytics',
    'accept',
    'only necessary',
    'reject'
  ]
  const lower = innerText.toLowerCase()
  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      return true
    }
  }
  return false
}

const inPageAPI = {
  classifyInnerText: (innerText) => {
    let innerTextSnippet = innerText.slice(0, MAX_LENGTH)
    let ifTruncated = ''
    if (innerTextSnippet.length !== innerText.length) {
      innerTextSnippet += '...'
      ifTruncated = `the first ${MAX_LENGTH} characters of `
    }
    const prompt = `An overlay element is considered to be a "cookie consent notice" if it meets all of these criteria:
1. it explicitly notifies the user of the site's use of cookies or other storage technology, such as: "We use cookies...", "This site uses...", etc.
2. it offers the user choices for the usage of cookies on the site, such as: "Accept", "Reject", "Learn More", etc., or informs the user that their use of the site means they accept the usage of cookies.

**Note:** This definition does not include adult content notices or any other type of notice that is primarily focused on age verification or content restrictions. Cookie consent notices are specifically intended to inform users about the website's use of cookies and obtain their consent for such use.

**Note:** A cookie consent notice should specifically relate to the site's use of cookies or other storage technology that stores data on the user's device, such as HTTP cookies, local storage, or session storage. Requests for permission to access geolocation information, camera, microphone, etc., do not fall under this category.

**Note:** Do NOT classify a website header or footer as a "cookie consent notice". Website headers or footers may contain a list of links, possibly including a privacy policy, cookie policy, or terms of service document, but their primary purpose is navigational rather than informational.

The following text was captured from ${ifTruncated}the innerText of an HTML overlay element:

\`\`\`
${innerTextSnippet}
\`\`\`

Is the overlay element above considered to be a "cookie consent notice"? Answer in one word.


`
    return openai.chat.completions.create({
      model: 'llama3',
      messages: [{ role: 'user', content: prompt }],
      // We only need enough tokens for "Yes" or "No"
      max_tokens: 1,
      // Fixed seed and zero temperature to avoid randomized responses
      seed: 1,
      temperature: 0
    }).then(response => {
      const answer = response.choices[0].message.content
      return answer.match(/yes/i)
    }).catch(e => {
      console.error('LLM classification failed:', e)
      return keywordClassifierFallback(innerText)
    })
  },
  getETLDP1: (() => {
    let init
    return (hostname) => {
      if (init === undefined) {
        init = new Promise(resolve => {
          fs.readFile(path.join(import.meta.dirname, '..', 'public_suffix_list.dat'), 'utf8')
            .then(data => {
              suffixList.parse(data, nodeUrl.domainToASCII)
              resolve(true)
            })
        })
      }
      return init.then(() => suffixList.getDomain(hostname))
    }
  })()
}

const shouldBlockRequest = (request) => {
  const url = request.url()

  // Block non-http/https URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.log(`Blocked URL: ${url}`)
    return true
  }

  return false
}

export const checkPage = async (args) => {
  const url = args.url
  const includeScreenshot = args.screenshot ?? true
  const slowCheck = args.slowCheck ?? false
  const blockNonHttpRequests = args.blockNonHttpRequests ?? true
  const deviceName = args.device

  const report = {
    url,
    timestamp: Date.now()
  }

  const templateProfile = templateProfilePathForArgs(args)
  // Only operate on a copy of the template profile
  const workingProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'cookiemonster-profile-'))

  try {
    await fs.cp(templateProfile, workingProfile, { recursive: true })
  } catch (err) {
    await fs.rm(workingProfile, { recursive: true })
    report.error = err.message
    return report
  }
  const listCatalogPath = path.join(workingProfile, 'gkboaolpopklhgplhaaiboijnklogmbc', '999.999', 'list_catalog.json')
  toggleAdblocklists(listCatalogPath, args.adblockLists)

  let proxyUrl
  if (args.location) {
    proxyUrl = await proxyChain.anonymizeProxy(proxyUrlWithAuth(args.location))
    console.log(`Started local proxy server: ${proxyUrl}`)
  }
  const puppeteerArgs = await puppeteerConfigForArgs({ ...args, pathForProfile: workingProfile, proxyServer: proxyUrl })

  console.log('Launching browser')
  const browser = await Sentry.startSpan({ name: 'Launch Browser' }, () => {
    return puppeteer.use(StealthPlugin()).launch(puppeteerArgs)
  })

  const page = await browser.newPage()

  try {
    if (blockNonHttpRequests) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('Blocked non-HTTP(S) request')
      }

      let blockError
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        if (shouldBlockRequest(request)) {
          request.abort()
          blockError = new Error('Blocked non-HTTP(S) request')
        } else {
          request.continue()
        }
      })
      if (blockError) {
        throw blockError
      }
    }

    // Emulate the device if the device name is set
    if (deviceName) {
      const device = KnownDevices[deviceName]
      await page.emulate(device)
    }

    await Sentry.startSpan({ name: 'domcontentloaded' }, () => {
      return page.goto(url, { waitUntil: 'domcontentloaded' })
    })
    console.log('Page loaded')

    const waitTimeMs = args.seconds * 1000

    if (slowCheck) {
      console.log('Performing slow check, waiting for network to settle.')
      try {
        await page.waitForNavigation({ waitUntil: ['load', 'networkidle2'], timeout: 30000 })
        console.log('Network settled')
      } catch (error) {
        console.warn('Navigation timed out or failed:', error.message)
      }
      await setTimeout(waitTimeMs) // wait longer for slow check
    }

    await setTimeout(waitTimeMs)

    const randomToken = generateRandomToken()

    await page.exposeFunction(randomToken, (name, ...args) => inPageAPI[name](...args))
    const inPageResult = await page.evaluateHandle(inPageRoutine, randomToken, args.hostOverride)
    try {
      if (await inPageResult.evaluate(r => r !== undefined)) {
        const l = await inPageResult.evaluate(r => r.length)
        if (l !== undefined && l > 1) {
          throw new Error('Too many candidate elements detected (' + l + ')')
        }
        report.identified = true
        const boundingBox = await inPageResult.boundingBox()
        if (boundingBox.height === 0 || boundingBox.width === 0) {
          // it won't work for a screenshot. Find another element to capture, somehow
        } else if (includeScreenshot && includeScreenshot !== 'fullPage') {
          const screenshotB64 = await inPageResult.screenshot({ omitBackground: true, optimizeForSpeed: true, encoding: 'base64' })
          report.screenshot = screenshotB64
        }
        report.markup = String(await unified()
          .use(rehypeParse, { fragment: true })
          .use(rehypeFormat)
          .use(rehypeStringify)
          .process(await inPageResult.evaluate(e => e.outerHTML))).trim()
      }
      // Add full page screenshot if explicitly requested or if no element was detected and screenshot is set to "always"
      if (['always', 'fullPage'].includes(includeScreenshot) && !report.screenshot) {
        // TODO: scroll to bottom to trigger lazy-loaded elements
        const screenshotB64 = await page.screenshot({ fullPage: true, omitBackground: true, optimizeForSpeed: true, encoding: 'base64' })
        report.screenshot = screenshotB64
      }
    } catch (err) {
      report.error = err.message
    } finally {
      await inPageResult.dispose()
    }
  } catch (err) {
    report.error = err.message
  } finally {
    await page.close()

    await browser.close()
    console.log('Browser closed')
    if (args.location) {
      await proxyChain.closeAnonymizedProxy(proxyUrl, true)
      console.log('Proxy closed')
    }

    await fs.rm(workingProfile, { recursive: true })
  }
  return report
}

export const prepareProfile = async (args) => {
  const tmpProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'cookiemonster-setup-profile-'))
  const templateProfile = templateProfilePathForArgs(args)

  if (existsSync(templateProfile)) {
    // Template profile already exists; return early
    console.log('profile directory already exists')
    return
  } else {
    // Create template profile directory
    await fs.mkdir(templateProfile)
  }

  await fetch('https://publicsuffix.org/list/public_suffix_list.dat')
    .then(resp => resp.text())
    .then(body => fs.writeFile(path.join(import.meta.dirname, '..', 'public_suffix_list.dat'), body))

  console.log('Performing initial profile setup...')
  const puppeteerArgs = await puppeteerConfigForArgs({ ...args, pathForProfile: tmpProfile })

  const browser = await puppeteer.launch(puppeteerArgs)

  const page = await browser.newPage()
  // Give the browser some time to register/download adblock components
  console.log('Wait until all components are registered')
  await checkAllComponentsRegistered(page)

  console.log('Updating Brave components')
  await page.goto('brave://components', { waitUntil: 'domcontentloaded' })
  const buttons = await page.$$('.button-check-update')
  for (const button of buttons) {
    const buttonId = await page.evaluate(el => el.getAttribute('id'), button)
    if (buttonId) {
      console.log('Updating component:', buttonId)
      await button.click()
      await setTimeout(100) // Wait for 100ms between clicks
    }
  }

  console.log('Waiting for components to update...')
  await setTimeout(500)
  await page.waitForFunction(() => {
    const elements = document.querySelectorAll('span[jscontent="status"]')
    return Array.from(elements)
      .map(el => el.innerText.trim())
      .filter(text => text !== '')
      .every(spanText => ['Component already up to date', 'Up-to-date', 'Component updated'].includes(spanText))
  }, { timeout: 60000 })
  console.log('Components updated')

  await page.close()

  await browser.close()

  // Clean up stale Singleton Lock
  await fs.rm(`${tmpProfile}/SingletonLock`, { force: true })
  // Clean up crx cache
  await fs.rm(`${tmpProfile}/component_crx_cache`, { force: true, recursive: true })

  const adblockComponents = parseListCatalogComponentIds({ profileDir: tmpProfile })

  readdirSync(tmpProfile).forEach(fileName => {
    // check if valid component id and not in keeplist
    if (isValidChromeComponentId({ id: fileName }) && !isKeeplistedComponentId({ id: fileName, additionalComponentList: adblockComponents })) {
      console.log('patching component: ', fileName)
      const extensionDir = path.join(tmpProfile, fileName)
      const versionDir = getExtensionVersion(extensionDir)
      const srcManifest = path.join(extensionDir, versionDir, 'manifest.json')
      const destPath = path.join(templateProfile, fileName, '999.999')
      replaceVersion({ fileName: srcManifest })
      mkdirSync(destPath, { recursive: true })
      if (fileName === 'gkboaolpopklhgplhaaiboijnklogmbc') {
        // copy List Catalog files after modifying version
        cpSync(path.join(extensionDir, versionDir), destPath, { recursive: true })
      } else {
        // only copy the manifest for all other components
        cpSync(srcManifest, path.join(destPath, 'manifest.json'))
      }
    } else {
      // copy all other files in profile directory, as well as keeplisted components
      cpSync(`${tmpProfile}/${fileName}`, `${templateProfile}/${fileName}`, { recursive: true })
    }
  })

  const optionalDefaultComponents = getOptionalDefaultComponentIds({ profileDir: tmpProfile })
  writeFileSync(path.join(import.meta.dirname, '..', 'adblock_lists.json'), JSON.stringify(optionalDefaultComponents, null, 2))

  await fs.rm(tmpProfile, { recursive: true })
  console.log('Done. Profile has been prepared for future use.')
}
