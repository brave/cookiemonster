import * as htmlExtractor from './html.mjs'
import * as visionCoordinatesExtractor from './vision_coordinates.mjs'

export const extractors = [
  htmlExtractor,
  visionCoordinatesExtractor
]

export async function runExtractors (page, options, extractors = ['vision_coordinates', 'html']) {
  const extractorMap = {
    html: htmlExtractor,
    vision_coordinates: visionCoordinatesExtractor
  }

  // Use specified extractors in the given order
  for (const name of extractors) {
    const extractor = extractorMap[name]
    if (!extractor) {
      throw new Error(`Unknown extractor: ${name}`)
    }

    // const inPageResult = await extractor.extract(page, options)
    const candidateElementsHandle = await extractor.extract(page, options)
    if (!candidateElementsHandle) { // some extractors return null if no elements are found
      continue
    }

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
