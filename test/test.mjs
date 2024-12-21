import { pathToFileURL } from 'url'
import { createHash } from 'crypto'
import path from 'path'
import { before, describe, it } from 'node:test'
import { cpus } from 'os'

import { checkPage, prepareProfile } from '../src/lib.mjs'

// Get browser path from environment variables with fallbacks
const browserPath = process.env.BRAVE_BINARY || '/usr/bin/brave'
console.log('Using browser executable:', browserPath)

const args = {
  seconds: 0,
  executablePath: browserPath,
  adblockLists: {
    eaokkjgnlhceblfhbhpeoebmfldocmnc: false,
    adcocjohghhfpidemphmcmlmhnfgikei: false,
    cdbbhgbmjhfnhnmgeddbliobbofkgdhe: false,
    bfpgedeaaibpoidldhjcknekahbikncb: false
  }
}
// Calculate concurrency based on TEST_CONCURRENCY env var or available CPU cores
const CONCURRENCY = process.env.TEST_CONCURRENCY
  ? parseInt(process.env.TEST_CONCURRENCY, 10)
  : Math.max(1, Math.floor(cpus().length / 2))
console.log(`Running tests with concurrency: ${CONCURRENCY}`)

async function testPage (t, testCasePath, expectedHash, expectedClassifierResults, expectedScrollBlocking) {
  const url = pathToFileURL(path.join(import.meta.dirname, 'data', testCasePath, 'index.html')).href
  const r = await checkPage({ url, hostOverride: testCasePath, blockNonHttpRequests: false, ...args })

  if (r.error) {
    throw new Error(`[${testCasePath}] ERROR: ${r.error}`)
  }

  let markupHash
  if (r.identified) {
    markupHash = createHash('sha256').update(r.markup).digest('base64')
  }

  const cookieNoticeTestName = expectedHash === undefined
    ? 'should not detect notice'
    : 'should detect notice'

  await t.test(cookieNoticeTestName, async (t) => {
    // t.diagnostic(r.markup)
    t.assert.strictEqual(markupHash, expectedHash,
      `expected hash "${expectedHash}" did not match markup "${markupHash}"`)
  })

  await t.test('scroll blocking detection', async (t) => {
    if (expectedScrollBlocking === undefined) {
      t.todo('scroll blocking test ignored')
    } else {
      t.assert.strictEqual(r.scrollBlocked, expectedScrollBlocking,
        `expected scroll blocking result [${expectedScrollBlocking}] did not match detected result [${r.scrollBlocked}]`)
    }
  })

  // Classifier results are only relevant if the page has a cookie notice
  if (expectedHash !== undefined) {
    await t.test('classifier results match', async (t) => {
      if (expectedClassifierResults === undefined) {
        t.todo('classifier result test ignored')
      } else {
        // Transform actual results to simple true/false format without weight
        const actualResults = Object.fromEntries(
          Object.entries(r.classifierResults).map(([key, value]) => [key, value.isMatch])
        )

        t.assert.deepEqual(actualResults, expectedClassifierResults,
          `expected classifier results ${JSON.stringify(expectedClassifierResults)} did not match actual results ${JSON.stringify(actualResults)}`)
      }
    })
  }
}

// url, expectedHash, classifierResults, expectedScrollBlocking
const testCases = [
  ['2021.rca.ac.uk', 'Xqoe/+M4l2gfBdZ6vazbTr5QaHUl3APEqal4Q3l7wDI=', { llm: true, keyword: true }, false],
  ['abxxx.com', undefined, undefined/* TODO */],
  ['bongacams.com', undefined, undefined/* TODO */],
  ['brave.com', undefined, undefined, false],
  ['cam4.com', 'O+Y60jG333dyHi6a3W1ZodZ7phKLk1Pr0SzhRHcKSps=', { llm: true, keyword: true }/* TODO */],
  ['cleveradvertising.com', undefined, undefined, false],
  ['copilot.microsoft.com', undefined, undefined, false],
  ['docs.base.org', 'n7VghBvQo9fKfh5nqf8XLRdgA5KpZc2xjjIla8XHO+k=', { llm: true, keyword: true }, false],
  ['drpc.org', '59blMPXMrimFarphox8PzbXUl7EGzBkqQXlb2DjMJYU=', { llm: true, keyword: true }, false],
  ['euronews.com', '19IiDcdMPth2k2wqKtnGQt5F9wo6Gq6ZzFEHNWCZjnI=', { llm: true, keyword: true }, true],
  ['fortune.com', 'a1+3zJekpAmX/usMwCHTBbpo/osoiNAJpGCKuOBzoLE=', { llm: true, keyword: true }, false],
  ['freevideo.cz', undefined/* TODO */],
  ['github.com', undefined, false],
  ['goibibo.com', undefined, true],
  ['goodreads.com', undefined, false],
  ['gostateparks.hawaii.gov', 'JBYwuwip4exVrQIqPUVGz+FWrjnVqwLj8vqq8TXAGs0=', { llm: true, keyword: true }, false],
  ['jamieoliver.com', undefined, false],
  ['jetsmart.com', undefined, false],
  ['liu.se', undefined, false],
  ['login.libero.it', 'EFDuHT+cKspFIMwPpsLit5MBkADL4cFifJSluFLUu6k=', { llm: true, keyword: true }, false],
  ['mamba.ru', '3Cyijp+TBuq8kMOT+yFakpK3GUdgBw3dH5M9x5gLbok=', { llm: true, keyword: true }, false],
  ['massagerepublic.com', undefined, true],
  ['moovitapp.com', 'yHJeNokduuywPXOjaF6MP9CJ4CBlF+X2H2u28UzLU6Y=', { llm: true, keyword: true }, false],
  ['myworldfix.com', undefined, false],
  ['nordarun.com', '3hfzlWrqxNkDKbXjcST9vWASCuPWUfA1e41DXZMZ82o=', { llm: true, keyword: true }, false],
  ['opensource.fb.com', '+5qjgLXR5vQPllW7bnKVkb97tTv4xG8TdAHJXmhiH2E=', { llm: true, keyword: true }, false],
  ['pleo.io', 'DRv+MeADAubtGiWXFF9agr8Wk9IkZmCZEoUVvK3CqAs=', { llm: true, keyword: true }, false],
  ['primor.eu', 'rNVsKt+hk6dlE1kWFXBFnk1JAbo3RQCca1IRCwOGJPw=', { llm: true, keyword: true }, true],
  ['privatekeys.pw', 'UCeiNrGF2DKp4gRogdcWQlWSrKi93/o6SsJkFpAb20U=', { llm: true, keyword: true }, false],
  ['stripchatgirls.com', 'O87YRCJw7yJGJVXqcPcWzgCuEFcva+67/ZChFxR0ULk=', { llm: true, keyword: true }/* TODO */],
  ['supabase.com', 'fyNq/gQyR53P46zGnFaQmzAcXthZrNTPgpjE5Qp+coE=', { llm: true, keyword: true }, false],
  ['temporal.cloud', 'bMYtB8cqUekB8ICfqzhjKDjkvqLxMMrfVEJsH55J+Pc=', { llm: true, keyword: true }, false],
  ['temporal.io', 'yOY8MZfiQ7cLtdQNOHeOgGlYP6AfZrRRmeZyjCLDIp4=', { llm: true, keyword: true }, false],
  ['videosdemadurasx.com', undefined, false],
  ['vine.co', undefined, false],
  ['voximplant.com', 'eibP8jYZYDWd1gOydbPONk71HShOp8TeCxdcrY37weI=', { llm: true, keyword: true }, false],
  ['withpersona.com', 'BttgC24/jLdzla0v9kPROTNRLx/guLNXvIJQcGlX0+g=', { llm: true, keyword: true }, false],
  ['worldoftanks.eu', undefined/* TODO */],
  ['www.arnotts.com', '+/BFJe+enU6qj0ZxCjZRR54Nvc1UHk4dSJ5othAycE0=', { llm: true, keyword: true }, false],
  ['www.asdatyres.co.uk', 'Qc9jfsaR6bbwRxt3Zgy7TmZpBjKPAOFCTf3D3ddzYoc=', { llm: true, keyword: true }, true],
  ['www.ashemaletube.com', undefined/* TODO */],
  ['www.epiphone.com', 'xBn4GTL8C3TLWkLdf1iDPXXSWC0Y/QfnTmr6M5bK4sI=', { llm: true, keyword: true }, true],
  ['www.escort.club', undefined, false],
  ['www.finn.no', 'YLqo3cOckIQCrg0TY5cvEVYKVjguJDBcJTRdZsrrLDM=', { llm: true, keyword: false }, true],
  ['www.france24.com', '429B8Qi/1LdaoPlJvQ9FjGlLvNUnVHIUR/D6eb6DBgE=', { llm: true, keyword: true }, true],
  ['www.g-star.com', 'tElFyJc98b8e1eIcMu7T4AyOR6b0mIaNvOAU6wwcPdU=', { llm: true, keyword: true }, false],
  ['www.heise.de', 'ILZYIEAu9Dh3pcdm7FS9EhQ3RKU8z7cfKVLp3h3NchI=', { llm: true, keyword: true }, true],
  ['www.intelligems.io', undefined, undefined, false],
  ['www.kafijasdraugs.lv', 'PNqCk+fE2Az2o+hzvNXiqe+HHWh23mmAzrZNd9zeHzo=', { llm: true, keyword: true }, true],
  ['www.kellanova.com', 'aZxeT/PGvgW5wcPMCkeXGJlXw88lC/GfEEJY+0bUXBU=', { llm: true, keyword: true }, false],
  ['www.lyrath.com', 'k2lGP0argaS6Iu+9XWZxDgNim2kFpq6JQGy5o7b6BHc=', { llm: true, keyword: true }, false],
  ['www.meld.io', 'SrMn/AlL+1vb9Ob9MneGIdHzuDVdK0QzOfBpLbBatCQ=', { llm: true, keyword: true }, false],
  ['www.myway.com', undefined, undefined, false],
  ['www.nerdwallet.com', undefined, undefined, false],
  ['www.newsflare.com', 'A1REDzJ4zCkWa3pUNGFFmChRUyObXuXONKwF/QA1s7A=', { llm: true, keyword: true }, false],
  ['www.northcoast.com', 'agltnUgo6/v/bKDMe116cck0BQqmYn17Ma8G1R3ZVm0=', { llm: true, keyword: true }, true],
  ['www.pibank.com', '/R/SbX32j2pKrsl33C+CGURTgOWeC2kNe1PW9VMh098=', { llm: true, keyword: true }, true],
  ['www.rebelmouse.com', undefined, undefined, false],
  ['www.refinery29.com', '+bdOjXMDngBgmjcnMxUSgSVBw9y0YCBZaGlrmJe9HF8=', { llm: true, keyword: true }, true],
  ['www.rfi.fr', 'pS86reCBOa5gdVYuGEtgrzS7IDgFIQex8Ac5fIwxJgI=', { llm: true, keyword: true }, true],
  ['www.ryanair.com', '1aXesNIeRzje8VpkE6hjGYCeBYPk1nnVpNynB1YCQY8=', { llm: true, keyword: true }, false],
  ['www.unilad.com', '/PXxl4ws/HZVHq2wBHQVO9PtKFNSHHrl1wfCfmoaZ9w=', { llm: true, keyword: true }, true],
  ['www.wardvillage.com', 'RiDcFOm/YVgP1DuCErIfD5/Va9KAXFoem+Pdcn2qZLA=', { llm: true, keyword: true }, false],
  ['www.whatnot.com', undefined, undefined, false],
  ['zora.co', 'ZQGVsHwN2dm4XfAmUeYQeV2b0eJxM45CFdQtDyeVjU0=', { llm: true, keyword: true }, false]
]

describe('Cookie consent tests', { concurrency: CONCURRENCY }, () => {
  // Setup profile once before all tests
  before(async () => {
    await prepareProfile(args)
  })

  for (const [testCasePath, expectedHash, expectedClassifierResults, expectedScrollBlocking] of testCases) {
    it(testCasePath, async (t) => {
      await testPage(t, testCasePath, expectedHash, expectedClassifierResults, expectedScrollBlocking)
    })
  }
})
