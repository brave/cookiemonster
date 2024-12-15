import * as keywordClassifier from './keyword.mjs'
import * as llmClassifier from './llm.mjs'

const classifierMap = {
  keyword: keywordClassifier,
  llm: llmClassifier
}

export async function runClassifiers (page, element, options, classifiers = ['llm', 'keyword', 'scrollblocked']) {
  const results = {}

  for (const classifierName of classifiers) {
    const classifier = classifierMap[classifierName]
    if (!classifier) {
      throw new Error(`Unknown classifier: ${classifierName}`)
    }

    try {
      const isMatch = await classifier.classify(page, element.innerText, options.openai)
      results[classifierName] = isMatch
    } catch (error) {
      console.error(`Classifier ${classifierName} failed:`, error)
      results[classifierName] = false
    }
  }

  return results
}
