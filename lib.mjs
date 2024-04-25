'use strict'

import fs from 'fs/promises';
import os from 'os';
import { setTimeout } from 'node:timers/promises';

import rehypeFormat from 'rehype-format';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

import Xvfb from 'xvfb';
import puppeteer from 'puppeteer-core';

import { puppeteerConfigForArgs } from './puppeteer.mjs'
import { inPageRoutine } from './inpage.mjs';

const setupEnv = (args) => {
  const xvfbPlatforms = new Set(['linux', 'openbsd'])

  const platformName = os.platform()

  let closeFunc

  if (args.interactive) {
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
  const url = args.url;

  const { puppeteerArgs, pathForProfile } = await puppeteerConfigForArgs(args)

  const envHandle = setupEnv(args)

  const report = {
    url,
    timestamp: Date.now(),
  };

  const browser = await puppeteer.launch(puppeteerArgs);
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const waitTimeMs = args.seconds * 1000
    await setTimeout(waitTimeMs);

    const inPageResult = await page.evaluateHandle(inPageRoutine);
    try {
      if (await inPageResult.evaluate(r => r !== undefined)) {
        report.identified = true;
        const boundingBox = await inPageResult.boundingBox();
        if (boundingBox.height === 0 || boundingBox.width === 0) {
          // it won't work for a screenshot. Find another element to capture, somehow
        } else {
          const screenshotB64 = await inPageResult.screenshot({ omitBackground: true, optimizeForSpeed: true, encoding: 'base64' });
          report.screenshot = screenshotB64;
        }
        report.markup = String(await unified()
          .use(rehypeParse, { fragment: true })
          .use(rehypeFormat)
          .use(rehypeStringify)
          .process(await inPageResult.evaluate(e => e.outerHTML))).trim();
      }
    } catch(err) {
      report.error = err.message;
    } finally {
      await inPageResult.dispose();
    }
  } catch (err) {
    report.error = err.message;
  } finally {
    await page.close()

    await browser.close()

    envHandle.close()

    // cleanup temp profile
    await fs.rm(pathForProfile, { recursive: true });
  }

  return report;
}
