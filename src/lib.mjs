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

import proxyChain from 'proxy-chain'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

import { puppeteerConfigForArgs } from './puppeteer.mjs'
import { inPageRoutine } from './inpage.mjs'
import { templateProfilePathForArgs, parseListCatalogComponentIds, isValidChromeComponentId, isKeeplistedComponentId, getExtensionVersion, getOptionalDefaultComponentIds, replaceVersion, toggleAdblocklists, proxyUrlWithAuth, checkAllComponentsRegistered } from './util.mjs'

// Generate a random string between [a000000000, zzzzzzzzzz] (base 36)
const generateRandomToken = () => {
  const min = Number.parseInt('a000000000', 36)
  const max = Number.parseInt('zzzzzzzzzz', 36)
  return Math.floor(Math.random() * (max - min) + min).toString(36)
}

const inPageAPI = {
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

export const checkPage = async (args) => {
  const url = args.url
  const includeScreenshot = args.screenshot ?? true

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
    await Sentry.startSpan({ name: 'domcontentloaded' }, () => {
      return page.goto(url, { waitUntil: 'domcontentloaded' })
    })
    console.log('Page loaded')

    const waitTimeMs = args.seconds * 1000
    await setTimeout(waitTimeMs)

    const randomToken = generateRandomToken();

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
      .every(spanText => ['Component already up to date', 'Component updated'].includes(spanText))
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
