import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import process from 'process';

const profilePathForArgs = async (args) => {
  const templateProfile = args.existingProfilePath || path.join(process.cwd(), 'profiles', 'ELC_off');

  // Create a new temporary location for the profile and copy to it.
  const destProfilePath = await fs.mkdtemp(path.join(os.tmpdir(), 'pagegraph-profile-' ))
  await fs.cp(templateProfile, destProfilePath, { recursive: true })

  return destProfilePath
}

export const puppeteerConfigForArgs = async (args) => {
  const pathForProfile = await profilePathForArgs(args)
  const puppeteerArgs = {
    defaultViewport: null,
    args: [
      '--disable-brave-update',
      '--user-data-dir=' + pathForProfile
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

  return { puppeteerArgs, pathForProfile }
}
