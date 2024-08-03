import { pathToFileURL } from 'url'
import { createHash } from 'crypto'
import path from 'path'
import AWSXRay from 'aws-xray-sdk-core'

import { checkPage, prepareProfile } from './lib.mjs'

const args = {
  seconds: 0,
  executablePath: process.argv[2] || '/usr/bin/brave',
  adblockLists: {
    '9F38E77A-64AA-4C5F-AF37-727CAE1266FF': false,
    'E99CBD02-FFD1-4651-9BDD-6A9ED7B87819': false,
    'AC023D22-AE88-4060-A978-4FEEEC4221693': false,
    '2F3DCE16-A19A-493C-A88F-2E110FBD37D6': false
  }
}

AWSXRay.setContextMissingStrategy((msg) => {}) // suppress errors if X-Ray is not configured

async function testPage (testCasePath, expectedHash) {
  const url = pathToFileURL(path.join('.', 'testcases', testCasePath, 'index.html')).href
  return checkPage({ url, ...args }).then(r => {
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
  ['brave.com', undefined],
  ['docs.base.org', 'n7VghBvQo9fKfh5nqf8XLRdgA5KpZc2xjjIla8XHO+k='],
  ['drpc.org', '59blMPXMrimFarphox8PzbXUl7EGzBkqQXlb2DjMJYU='],
  ['euronews.com', '19IiDcdMPth2k2wqKtnGQt5F9wo6Gq6ZzFEHNWCZjnI='],
  ['fortune.com', 'a1+3zJekpAmX/usMwCHTBbpo/osoiNAJpGCKuOBzoLE='],
  ['github.com', undefined],
  ['gostateparks.hawaii.gov', 'JBYwuwip4exVrQIqPUVGz+FWrjnVqwLj8vqq8TXAGs0='],
  ['nordarun.com', '3hfzlWrqxNkDKbXjcST9vWASCuPWUfA1e41DXZMZ82o='],
  ['opensource.fb.com', '+5qjgLXR5vQPllW7bnKVkb97tTv4xG8TdAHJXmhiH2E='],
  ['pleo.io', 'DRv+MeADAubtGiWXFF9agr8Wk9IkZmCZEoUVvK3CqAs='],
  ['privatekeys.pw', 'UCeiNrGF2DKp4gRogdcWQlWSrKi93/o6SsJkFpAb20U='],
  ['supabase.com', 'fyNq/gQyR53P46zGnFaQmzAcXthZrNTPgpjE5Qp+coE='],
  ['temporal.cloud', 'bMYtB8cqUekB8ICfqzhjKDjkvqLxMMrfVEJsH55J+Pc='],
  ['www.arnotts.com', '+/BFJe+enU6qj0ZxCjZRR54Nvc1UHk4dSJ5othAycE0='],
  ['www.g-star.com', 'tElFyJc98b8e1eIcMu7T4AyOR6b0mIaNvOAU6wwcPdU='],
  ['www.kellanova.com', 'aZxeT/PGvgW5wcPMCkeXGJlXw88lC/GfEEJY+0bUXBU='],
  ['www.meld.io', 'SrMn/AlL+1vb9Ob9MneGIdHzuDVdK0QzOfBpLbBatCQ='],
  ['www.wardvillage.com', 'RiDcFOm/YVgP1DuCErIfD5/Va9KAXFoem+Pdcn2qZLA='],
  ['zora.co', 'ZQGVsHwN2dm4XfAmUeYQeV2b0eJxM45CFdQtDyeVjU0=']
]

let failed = 0

await prepareProfile(args)
for (const [testCase, expectedHash] of testCases) {
  const testPassed = await testPage(testCase, expectedHash)
  if (!testPassed) {
    failed += 1
  }
}

console.log('\n')

if (failed === 0) {
  console.log('All test cases passed.')
} else {
  console.log(`${testCases.length - failed} out of ${testCases.length} tests passed.`)
  process.exit(-1)
}
