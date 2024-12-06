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

async function testPage (testCasePath, expectedHash) {
  const url = pathToFileURL(path.join(import.meta.dirname, 'data', testCasePath, 'index.html')).href
  return checkPage({ url, hostOverride: testCasePath, blockNonHttpRequests: false, ...args }).then(r => {
    if (r.error) {
      console.log('[' + testCasePath + '] ERROR: ' + r.error)
      return false
    }

    let markupHash
    if (r.identified) {
      markupHash = createHash('sha256').update(r.markup).digest('base64')
    }

    if (expectedHash !== markupHash) {
      console.log('[' + testCasePath + '] expected hash "' + expectedHash + '" did not match markup "' + markupHash + '"')
      return false
    } else {
      console.log('[' + testCasePath + '] success')
      return true
    }
  })
}

const testCases = [
  ['2021.rca.ac.uk', 'Xqoe/+M4l2gfBdZ6vazbTr5QaHUl3APEqal4Q3l7wDI='],
  ['abxxx.com', undefined],
  ['bongacams.com', undefined],
  ['brave.com', undefined],
  ['cam4.com', 'O+Y60jG333dyHi6a3W1ZodZ7phKLk1Pr0SzhRHcKSps='],
  ['cleveradvertising.com', undefined],
  ['copilot.microsoft.com', undefined],
  ['docs.base.org', 'n7VghBvQo9fKfh5nqf8XLRdgA5KpZc2xjjIla8XHO+k='],
  ['drpc.org', '59blMPXMrimFarphox8PzbXUl7EGzBkqQXlb2DjMJYU='],
  ['euronews.com', '19IiDcdMPth2k2wqKtnGQt5F9wo6Gq6ZzFEHNWCZjnI='],
  ['fortune.com', 'a1+3zJekpAmX/usMwCHTBbpo/osoiNAJpGCKuOBzoLE='],
  ['freevideo.cz', undefined],
  ['github.com', undefined],
  ['goibibo.com', undefined],
  ['goodreads.com', undefined],
  ['gostateparks.hawaii.gov', 'JBYwuwip4exVrQIqPUVGz+FWrjnVqwLj8vqq8TXAGs0='],
  ['jamieoliver.com', undefined],
  ['jetsmart.com', undefined],
  ['liu.se', undefined],
  ['login.libero.it', 'EFDuHT+cKspFIMwPpsLit5MBkADL4cFifJSluFLUu6k='],
  ['mamba.ru', '3Cyijp+TBuq8kMOT+yFakpK3GUdgBw3dH5M9x5gLbok='],
  ['massagerepublic.com', undefined],
  ['moovitapp.com', 'yHJeNokduuywPXOjaF6MP9CJ4CBlF+X2H2u28UzLU6Y='],
  ['myworldfix.com', undefined],
  ['nordarun.com', '3hfzlWrqxNkDKbXjcST9vWASCuPWUfA1e41DXZMZ82o='],
  ['opensource.fb.com', '+5qjgLXR5vQPllW7bnKVkb97tTv4xG8TdAHJXmhiH2E='],
  ['pleo.io', 'DRv+MeADAubtGiWXFF9agr8Wk9IkZmCZEoUVvK3CqAs='],
  ['primor.eu', 'rNVsKt+hk6dlE1kWFXBFnk1JAbo3RQCca1IRCwOGJPw='],
  ['privatekeys.pw', 'UCeiNrGF2DKp4gRogdcWQlWSrKi93/o6SsJkFpAb20U='],
  ['stripchatgirls.com', 'O87YRCJw7yJGJVXqcPcWzgCuEFcva+67/ZChFxR0ULk='],
  ['supabase.com', 'fyNq/gQyR53P46zGnFaQmzAcXthZrNTPgpjE5Qp+coE='],
  ['temporal.cloud', 'bMYtB8cqUekB8ICfqzhjKDjkvqLxMMrfVEJsH55J+Pc='],
  ['temporal.io', 'yOY8MZfiQ7cLtdQNOHeOgGlYP6AfZrRRmeZyjCLDIp4='],
  ['videosdemadurasx.com', undefined],
  ['vine.co', undefined],
  ['voximplant.com', 'eibP8jYZYDWd1gOydbPONk71HShOp8TeCxdcrY37weI='],
  ['withpersona.com', 'BttgC24/jLdzla0v9kPROTNRLx/guLNXvIJQcGlX0+g='],
  ['worldoftanks.eu', undefined],
  ['www.arnotts.com', '+/BFJe+enU6qj0ZxCjZRR54Nvc1UHk4dSJ5othAycE0='],
  ['www.ashemaletube.com', undefined],
  ['www.cyclingstage.com', 'yx68EI3WxyY5Q2SjsYiYegFlxOebIWPYoxKwH45uKjw='],
  ['www.escort.club', undefined],
  ['www.finn.no', 'YLqo3cOckIQCrg0TY5cvEVYKVjguJDBcJTRdZsrrLDM='],
  ['www.france24.com', '429B8Qi/1LdaoPlJvQ9FjGlLvNUnVHIUR/D6eb6DBgE='],
  ['www.g-star.com', 'tElFyJc98b8e1eIcMu7T4AyOR6b0mIaNvOAU6wwcPdU='],
  ['www.heise.de', 'ILZYIEAu9Dh3pcdm7FS9EhQ3RKU8z7cfKVLp3h3NchI='],
  ['www.intelligems.io', undefined],
  ['www.kellanova.com', 'aZxeT/PGvgW5wcPMCkeXGJlXw88lC/GfEEJY+0bUXBU='],
  ['www.lyrath.com', 'k2lGP0argaS6Iu+9XWZxDgNim2kFpq6JQGy5o7b6BHc='],
  ['www.meld.io', 'SrMn/AlL+1vb9Ob9MneGIdHzuDVdK0QzOfBpLbBatCQ='],
  ['www.myway.com', undefined],
  ['www.nerdwallet.com', undefined],
  ['www.rebelmouse.com', undefined],
  ['www.refinery29.com', '+bdOjXMDngBgmjcnMxUSgSVBw9y0YCBZaGlrmJe9HF8='],
  ['www.rfi.fr', 'pS86reCBOa5gdVYuGEtgrzS7IDgFIQex8Ac5fIwxJgI='],
  ['www.ryanair.com', '1aXesNIeRzje8VpkE6hjGYCeBYPk1nnVpNynB1YCQY8='],
  ['www.unilad.com', '/PXxl4ws/HZVHq2wBHQVO9PtKFNSHHrl1wfCfmoaZ9w='],
  ['www.wardvillage.com', 'RiDcFOm/YVgP1DuCErIfD5/Va9KAXFoem+Pdcn2qZLA='],
  ['www.whatnot.com', undefined],
  ['zora.co', 'ZQGVsHwN2dm4XfAmUeYQeV2b0eJxM45CFdQtDyeVjU0=']
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
