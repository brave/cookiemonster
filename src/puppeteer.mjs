import { templateProfilePathForArgs } from './util.mjs'

export const puppeteerConfigForArgs = async (args) => {
  const puppeteerArgs = {
    defaultViewport: null,
    timeout: 0,
    args: [
      '--disable-brave-update',
      '--no-sandbox',
      '--no-zygote',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-gpu-early-init',
      '--disable-gpu-memory-buffer-compositor-resources',
      '--disable-gpu-memory-buffer-video-frames',
      '--disable-gpu-program-cache',
      '--disable-gpu-rasterization',
      '--disable-gpu-sandbox',
      '--disable-gpu-vsync',
      '--disable-gpu-watchdog',
      '--user-data-dir=' + (args.pathForProfile || templateProfilePathForArgs(args))
    ],
    executablePath: args.executablePath,
    ignoreDefaultArgs: [
      '--disable-sync'
    ],
    headless: false
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
