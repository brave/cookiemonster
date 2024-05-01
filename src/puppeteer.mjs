import { templateProfilePathForArgs } from './util.mjs';

export const puppeteerConfigForArgs = async (args) => {
  const puppeteerArgs = {
    defaultViewport: null,
    args: [
      '--disable-brave-update',
      '--user-data-dir=' + (args.pathForProfile || templateProfilePathForArgs(args)),
    ],
    executablePath: args.executablePath,
    ignoreDefaultArgs: [
      '--disable-sync'
    ],
    headless: false
  }

  if (args.debugLevel === 'verbose') {
    puppeteerArgs.args.push('--enable-logging=stderr')
    puppeteerArgs.args.push('--v=0')
  }

  if (args.extraArgs) {
    puppeteerArgs.args.push(...args.extraArgs)
  }

  return puppeteerArgs;
}
