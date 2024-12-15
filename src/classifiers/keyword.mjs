const keywords = [
  'cookies',
  'consent',
  'privacy',
  'analytics',
  'accept',
  'only necessary',
  'reject'
]

export async function classify (page, text) {
  const lower = text.toLowerCase()
  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      return true
    }
  }
  return false
}
