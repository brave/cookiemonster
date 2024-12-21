import * as htmlExtractor from './html.mjs'

export const extractors = [
  htmlExtractor
]

export async function runExtractors (page, options, extractors = ['html']) {
  const extractorMap = {
    html: htmlExtractor
  }

  // Use specified extractors in the given order
  for (const name of extractors) {
    const extractor = extractorMap[name]
    if (!extractor) {
      throw new Error(`Unknown extractor: ${name}`)
    }

    // const inPageResult = await extractor.extract(page, options)
    const candidateElementsHandle = await extractor.extract(page, options)
    const candidateElementsCount = await candidateElementsHandle.evaluate(r => r.length)

    try {
      if (candidateElementsCount > 0) {
        return {
          extractor: name,
          candidateElementsHandle,
          candidateElementsCount
        }
      }
    } finally {
      if (candidateElementsCount < 1) {
        await candidateElementsHandle.dispose() // dispose of the result if no elements were found
      }
    }
  }
  return {
    extractor: null,
    candidateElements: null // return empty handle?
  }
}
