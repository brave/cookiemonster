'use strict'

import { prepareProfile } from './lib.mjs'

const executablePath = process.argv[2] || '/usr/bin/brave'

console.log(`Browser binary: ${executablePath}\n`)

console.log('Preparing `ELC_on` profile...')
await prepareProfile({ executablePath })
console.log('Preparing `ELC_off` profile...')
await prepareProfile({ executablePath, disableCookieList: true })
