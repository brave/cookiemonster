'use strict'

import { prepareProfile } from './lib.mjs'

const executablePath = process.argv[2] || '/usr/bin/brave'

console.log(`Browser binary: ${executablePath}\n`)

console.log('Preparing base profile...')
await prepareProfile({ executablePath })
