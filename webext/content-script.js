/* eslint-env browser */

const inPageRoutine = import(chrome.runtime.getURL('inpage.mjs')).then(module => module.inPageRoutine)

// Generate a random string between [a000000000, zzzzzzzzzz] (base 36)
const generateRandomToken = () => {
  const min = Number.parseInt('a000000000', 36)
  const max = Number.parseInt('zzzzzzzzzz', 36)
  return Math.floor(Math.random() * (max - min) + min).toString(36)
}

const randomToken = generateRandomToken()
window[randomToken] = async (...args) => {
  const response = await chrome.runtime.sendMessage(args)
  return response
}

const jobs = []

const check = async () => {
  const result = await (await inPageRoutine)(randomToken, undefined)
  console.log(result)
  if (result !== undefined && result.length === undefined) {
    jobs.forEach(job => clearTimeout(job))
    chrome.runtime.sendMessage(['detected'])
  }
}

check()
jobs.push(setTimeout(check, 500))
jobs.push(setTimeout(check, 1000))
jobs.push(setTimeout(check, 2000))
jobs.push(setTimeout(check, 4000))
jobs.push(setTimeout(check, 8000))
