import { pathToFileURL } from 'url'
import { createHash } from 'crypto'
import path from 'path'

import { checkPage, prepareProfile } from '../src/lib.mjs'

const args = {
  seconds: 0,
  executablePath: process.argv[2] || '/usr/bin/brave',
  adblockLists: {
    eaokkjgnlhceblfhbhpeoebmfldocmnc: false,
    adcocjohghhfpidemphmcmlmhnfgikei: false,
    cdbbhgbmjhfnhnmgeddbliobbofkgdhe: false,
    bfpgedeaaibpoidldhjcknekahbikncb: false
  }
}

async function testPage (testCasePath, expectedHash, expectedScrollBlocking) {
  const url = pathToFileURL(path.join(import.meta.dirname, 'data', testCasePath, 'index.html')).href
  return checkPage({ url, hostOverride: testCasePath, blockNonHttpRequests: false, ...args }).then(r => {
    if (r.error) {
      console.log('[' + testCasePath + '] ERROR: ' + r.error)
      return false
    }

    const failures = []
    const warnings = []

    let markupHash
    if (r.identified) {
      markupHash = createHash('sha256').update(r.markup).digest('base64')
    }

    if (expectedHash !== markupHash) {
      failures.push('expected cookie notice hash "' + expectedHash + '" did not match detected markup "' + markupHash + '"')
    }

    if (expectedScrollBlocking === undefined) {
      // once more scroll blocking testcases have been gathered, it should
      // be possible to improve the heuristics and remove the warnings
      warnings.push('scroll blocking test ignored')
    } else if (expectedScrollBlocking !== r.scrollBlocked) {
      failures.push(`expected scroll blocking result [${expectedScrollBlocking}] did not match detected result [${r.scrollBlocked}]`)
    }

    const success = failures.length === 0
    const testStatus = success ? 'success' : 'failure'
    console.log(`[${testCasePath}] ${testStatus}`)
    for (const failure of failures) {
      console.log(` - ${failure}`)
    }
    for (const warning of warnings) {
      console.log(` - ${warning}`)
    }

    return failures.length === 0
  })
}

const testCases = [
  ['2021.rca.ac.uk', 'Xqoe/+M4l2gfBdZ6vazbTr5QaHUl3APEqal4Q3l7wDI=', false],
  ['abxxx.com', undefined/* TODO */],
  ['bongacams.com', undefined/* TODO */],
  ['brave.com', undefined, false],
  ['cam4.com', 'O+Y60jG333dyHi6a3W1ZodZ7phKLk1Pr0SzhRHcKSps='/* TODO */],
  ['cleveradvertising.com', undefined, false],
  ['copilot.microsoft.com', undefined, false],
  ['docs.base.org', 'n7VghBvQo9fKfh5nqf8XLRdgA5KpZc2xjjIla8XHO+k=', false],
  ['drpc.org', '59blMPXMrimFarphox8PzbXUl7EGzBkqQXlb2DjMJYU=', false],
  ['euronews.com', '19IiDcdMPth2k2wqKtnGQt5F9wo6Gq6ZzFEHNWCZjnI=', true],
  ['fortune.com', 'a1+3zJekpAmX/usMwCHTBbpo/osoiNAJpGCKuOBzoLE=', false],
  ['freevideo.cz', undefined/* TODO */],
  ['github.com', undefined, false],
  ['goibibo.com', undefined, true],
  ['goodreads.com', undefined, false],
  ['gostateparks.hawaii.gov', 'JBYwuwip4exVrQIqPUVGz+FWrjnVqwLj8vqq8TXAGs0=', false],
  ['jamieoliver.com', undefined, false],
  ['jetsmart.com', undefined, false],
  ['liu.se', undefined, false],
  ['login.libero.it', 'EFDuHT+cKspFIMwPpsLit5MBkADL4cFifJSluFLUu6k=', false],
  ['mamba.ru', '3Cyijp+TBuq8kMOT+yFakpK3GUdgBw3dH5M9x5gLbok=', false],
  ['massagerepublic.com', undefined, true],
  ['moovitapp.com', 'yHJeNokduuywPXOjaF6MP9CJ4CBlF+X2H2u28UzLU6Y=', false],
  ['myworldfix.com', undefined, false],
  ['nordarun.com', '3hfzlWrqxNkDKbXjcST9vWASCuPWUfA1e41DXZMZ82o=', false],
  ['opensource.fb.com', '+5qjgLXR5vQPllW7bnKVkb97tTv4xG8TdAHJXmhiH2E=', false],
  ['pleo.io', 'DRv+MeADAubtGiWXFF9agr8Wk9IkZmCZEoUVvK3CqAs=', false],
  ['primor.eu', 'rNVsKt+hk6dlE1kWFXBFnk1JAbo3RQCca1IRCwOGJPw=', true],
  ['privatekeys.pw', 'UCeiNrGF2DKp4gRogdcWQlWSrKi93/o6SsJkFpAb20U=', false],
  ['stripchatgirls.com', 'O87YRCJw7yJGJVXqcPcWzgCuEFcva+67/ZChFxR0ULk='/* TODO */],
  ['supabase.com', 'fyNq/gQyR53P46zGnFaQmzAcXthZrNTPgpjE5Qp+coE=', false],
  ['temporal.cloud', 'bMYtB8cqUekB8ICfqzhjKDjkvqLxMMrfVEJsH55J+Pc=', false],
  ['temporal.io', 'yOY8MZfiQ7cLtdQNOHeOgGlYP6AfZrRRmeZyjCLDIp4=', false],
  ['videosdemadurasx.com', undefined, false],
  ['vine.co', undefined, false],
  ['voximplant.com', 'eibP8jYZYDWd1gOydbPONk71HShOp8TeCxdcrY37weI=', false],
  ['withpersona.com', 'BttgC24/jLdzla0v9kPROTNRLx/guLNXvIJQcGlX0+g=', false],
  ['worldoftanks.eu', undefined/* TODO */],
  ['www.arnotts.com', '+/BFJe+enU6qj0ZxCjZRR54Nvc1UHk4dSJ5othAycE0=', false],
  ['www.asdatyres.co.uk', 'Qc9jfsaR6bbwRxt3Zgy7TmZpBjKPAOFCTf3D3ddzYoc=', true],
  ['www.ashemaletube.com', undefined/* TODO */],
  ['www.epiphone.com', 'xBn4GTL8C3TLWkLdf1iDPXXSWC0Y/QfnTmr6M5bK4sI=', true],
  ['www.escort.club', undefined, false],
  ['www.finn.no', 'YLqo3cOckIQCrg0TY5cvEVYKVjguJDBcJTRdZsrrLDM=', true],
  ['www.france24.com', '429B8Qi/1LdaoPlJvQ9FjGlLvNUnVHIUR/D6eb6DBgE=', true],
  ['www.g-star.com', 'tElFyJc98b8e1eIcMu7T4AyOR6b0mIaNvOAU6wwcPdU=', false],
  ['www.heise.de', 'ILZYIEAu9Dh3pcdm7FS9EhQ3RKU8z7cfKVLp3h3NchI=', true],
  ['www.intelligems.io', undefined, false],
  ['www.kafijasdraugs.lv', 'PNqCk+fE2Az2o+hzvNXiqe+HHWh23mmAzrZNd9zeHzo=', true],
  ['www.kellanova.com', 'aZxeT/PGvgW5wcPMCkeXGJlXw88lC/GfEEJY+0bUXBU=', false],
  ['www.lyrath.com', 'k2lGP0argaS6Iu+9XWZxDgNim2kFpq6JQGy5o7b6BHc=', false],
  ['www.meld.io', 'SrMn/AlL+1vb9Ob9MneGIdHzuDVdK0QzOfBpLbBatCQ=', false],
  ['www.myway.com', undefined, false],
  ['www.nerdwallet.com', undefined, false],
  ['www.newsflare.com', 'A1REDzJ4zCkWa3pUNGFFmChRUyObXuXONKwF/QA1s7A=', false],
  ['www.northcoast.com', 'agltnUgo6/v/bKDMe116cck0BQqmYn17Ma8G1R3ZVm0=', true],
  ['www.pibank.com', '/R/SbX32j2pKrsl33C+CGURTgOWeC2kNe1PW9VMh098=', true],
  ['www.rebelmouse.com', undefined, false],
  ['www.refinery29.com', '+bdOjXMDngBgmjcnMxUSgSVBw9y0YCBZaGlrmJe9HF8=', true],
  ['www.rfi.fr', 'pS86reCBOa5gdVYuGEtgrzS7IDgFIQex8Ac5fIwxJgI=', true],
  ['www.ryanair.com', '1aXesNIeRzje8VpkE6hjGYCeBYPk1nnVpNynB1YCQY8=', false],
  ['www.unilad.com', '/PXxl4ws/HZVHq2wBHQVO9PtKFNSHHrl1wfCfmoaZ9w=', true],
  ['www.wardvillage.com', 'RiDcFOm/YVgP1DuCErIfD5/Va9KAXFoem+Pdcn2qZLA=', false],
  ['www.whatnot.com', undefined, false],
  ['zora.co', 'ZQGVsHwN2dm4XfAmUeYQeV2b0eJxM45CFdQtDyeVjU0=', false]
]

const failures = []

await prepareProfile(args)
for (const testExpectation of testCases) {
  const testPassed = await testPage(...testExpectation)
  if (!testPassed) {
    failures.push(testExpectation[0])
  }
}

console.log('\n')

if (failures.length === 0) {
  console.log('All test cases passed.')
} else {
  console.log(`${testCases.length - failures.length} out of ${testCases.length} tests passed.`)
  console.log('Failures:')
  for (const failure of failures) {
    console.log(`  ${failure}`)
  }
  process.exit(-1)
}
