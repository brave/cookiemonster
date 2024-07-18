import { templateProfilePathForArgs } from './util.mjs'

export const puppeteerConfigForArgs = async (args) => {
  const puppeteerArgs = {
    defaultViewport: null,
    timeout: 0,
    args: [
      '--disable-brave-update',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--in-process-gpu',
      '--no-zygote',
      '--enable-features=NetworkServiceInProcess2',
      //'--single-process',
      '--user-data-dir=' + (args.pathForProfile || templateProfilePathForArgs(args))
    ],
    executablePath: args.executablePath,
    ignoreDefaultArgs: [
      '--disable-sync',
      '--user-data-dir'
    ],
    headless: true
  }

  if (args.debugLevel === 'verbose') {
    puppeteerArgs.args.push('--enable-logging=stderr')
    puppeteerArgs.args.push('--v=1')
    puppeteerArgs.dumpio = true
  }

  if (args.extraArgs) {
    puppeteerArgs.args.push(...args.extraArgs)
  }

  return puppeteerArgs
}
