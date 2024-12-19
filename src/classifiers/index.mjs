import * as keywordClassifier from './keyword.mjs'
import * as llmClassifier from './llm.mjs'

export const classifierMap = {
  llm: {
    classifier: llmClassifier,
    weight: 20
  },
  keyword: {
    classifier: keywordClassifier,
    weight: 10
  }
}

export async function runClassifiers (page, element, options, classifiers = ['llm', 'keyword', 'scrollblocked']) {
  const results = {}

  for (const classifierName of classifiers) {
    const classifier = classifierMap[classifierName]
    if (!classifier) {
      throw new Error(`Unknown classifier: ${classifierName}`)
    }

    try {
      const isMatch = await classifier.classifier.classify(page, element.innerText, options.openai)
      results[classifierName] = {
        isMatch,
        weight: classifier.weight
      }
    } catch (error) {
      console.error(`Classifier ${classifierName} failed:`, error)
      results[classifierName] = {
        isMatch: null,
        weight: classifier.weight
      }
    }
  }

  // Find verdict from highest weight non-null result
  const verdict = Object.entries(results)
    .sort(([, a], [, b]) => b.weight - a.weight) // Sort by weight descending
    .find(([, result]) => result.isMatch !== null) // Find first non-null result
    ?.at(1)?.isMatch // Get the isMatch value, or undefined if all results were null

  return {
    results,
    verdict
  }
}
