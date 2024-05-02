'use strict'

import { existsSync } from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { setTimeout } from 'node:timers/promises'

import rehypeFormat from 'rehype-format'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'

import Xvfb from 'xvfb'
import puppeteer from 'puppeteer-core'

import { puppeteerConfigForArgs } from './puppeteer.mjs'
import { inPageRoutine } from './inpage.mjs'
import { templateProfilePathForArgs } from './util.mjs'

const setupEnv = (interactive) => {
  const xvfbPlatforms = new Set(['linux', 'openbsd'])

  const platformName = os.platform()

  let closeFunc

  if (interactive) {
    closeFunc = () => { }
  } else if (xvfbPlatforms.has(platformName)) {
    const xvfbHandle = new Xvfb({
      // ensure 24-bit color depth or rendering might choke
      xvfb_args: ['-screen', '0', '1024x768x24']
    })
    xvfbHandle.startSync()
    closeFunc = () => {
      xvfbHandle.stopSync()
    }
  } else {
    closeFunc = () => {}
  }

  return {
    close: closeFunc
  }
}

export const checkPage = async (args) => {
  const url = args.url

  const templateProfile = templateProfilePathForArgs(args)

  // Only operate on a copy of the template profile
  const workingProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'cookiemonster-profile-'))
  await fs.cp(templateProfile, workingProfile, { recursive: true })
  args.pathForProfile = workingProfile

  const puppeteerArgs = await puppeteerConfigForArgs(args)

  const envHandle = setupEnv(args.interactive)

  const report = {
    url,
    timestamp: Date.now()
  }

  const browser = await puppeteer.launch(puppeteerArgs)
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const waitTimeMs = args.seconds * 1000
    await setTimeout(waitTimeMs)

    const inPageResult = await page.evaluateHandle(inPageRoutine)
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
        } else {
          const screenshotB64 = await inPageResult.screenshot({ omitBackground: true, optimizeForSpeed: true, encoding: 'base64' })
          report.screenshot = screenshotB64
        }
        report.markup = String(await unified()
          .use(rehypeParse, { fragment: true })
          .use(rehypeFormat)
          .use(rehypeStringify)
          .process(await inPageResult.evaluate(e => e.outerHTML))).trim()
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

    envHandle.close()

    await fs.rm(workingProfile, { recursive: true })
  }

  return report
}

export const prepareProfile = async (args) => {
  const { executablePath, interactive, disableCookieList } = args

  const templateProfile = templateProfilePathForArgs(args)
  if (existsSync(templateProfile)) {
    // Template profile already exists; return early
    return
  }

  console.log('Performing initial profile setup...')

  const puppeteerArgs = await puppeteerConfigForArgs(args)

  const envHandle = setupEnv(interactive)

  const browser = await puppeteer.launch(puppeteerArgs)

  // Give the browser some time to update adblock components
  await setTimeout(10000)

  const page = await browser.newPage()
  await page.goto('brave://settings/shields/filters', { waitUntil: 'domcontentloaded' })

  // Toggle the EasyList Cookie entry to the intended setting
  await page.evaluate(async (ELC_enabled) => {
    // Unfortunately this seems like the only way to select all the way through the shadow roots...
    const browserProxy = document.querySelectorAll('settings-ui')[0].shadowRoot
      .getElementById('main').shadowRoot
      .querySelectorAll('settings-basic-page')[0].shadowRoot
      .querySelectorAll('settings-default-brave-shields-page')[0].shadowRoot
      .querySelectorAll('adblock-subpage')[0]
      .browserProxy_

    await browserProxy.enableFilterList('AC023D22-AE88-4060-A978-4FEEEC4221693', ELC_enabled)
  }, !disableCookieList)

  await page.close()

  await browser.close()

  envHandle.close()

  console.log('Done. Profile has been cached for future use.')
}
