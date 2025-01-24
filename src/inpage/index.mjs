/* eslint-env browser */

const windowRect = {
  left: 0,
  right: window.innerWidth,
  top: 0,
  bottom: window.innerHeight
}

/**
 * Collects all elements from the DOM that match the provided criteria
 * @param {Function} criteria
 */
const collectMatchingElements = (criteria) => {
  const elements = []
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_ELEMENT,
    e => criteria(e) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
  )
  while (walker.nextNode()) {
    elements.push(walker.currentNode)
  }
  return elements
}

/**
 * Like Array.prototype.filter, but with support for async callbacks
 */
const asyncFilter = async (arr, predicate) => Promise.all(arr.map(predicate))
  .then((results) => arr.filter((_v, index) => results[index]))

/**
 * Returns false for hidden elements, or elements outside of the bounds of the viewport
 */
const isVisible = node => {
  if (!(node.checkVisibility && node.checkVisibility())) {
    return false
  }
  const nodeRect = node.getBoundingClientRect()
  if (nodeRect.left >= windowRect.right ||
      nodeRect.right <= windowRect.left ||
      nodeRect.top >= windowRect.bottom ||
      nodeRect.bottom <= windowRect.top) {
    return false
  }
  return true
}

/**
 * Returns only the elements that are *not* ancestors of any other input element
 */
const nonParentElements = elements => {
  const results = []
  if (elements.length > 0) {
    for (let i = elements.length - 1; i >= 0; i--) {
      let container = false
      for (let j = 0; j < elements.length; j++) {
        if (i !== j && elements[i].contains(elements[j])) {
          container = true
          break
        }
      }
      if (!container) {
        results.push(elements[i])
      }
    }
  }
  return results
}

/**
 * Returns false for elements that contain *both*:
 *  - more than 10 first-party links, and
 *  - more first-party links than third-party links
 */
const hasManyFirstPartyLinks = async (getETLDP1, thisDomain, e) => {
  const linkPartiness = await Promise.all(Array.from(e.querySelectorAll('a[href]')).map(async a => {
    const linkETLDP1 = await getETLDP1(new URL(a.href).host)
    return thisDomain === linkETLDP1
  }))
  const linkPartinessCount = linkPartiness.reduce((acc, v) => {
    if (v === true) {
      acc.first += 1
    } else {
      acc.third += 1
    }
    return acc
  }, { first: 0, third: 0 })

  if (linkPartinessCount.first > 10 && linkPartinessCount.first > linkPartinessCount.third) {
    return false
  }

  return true
}

/**
 * Uses the hostAPI to classify the inner text of an HTML element as either a cookie notice or not.
 * @param classifiersUsed {Set}
 */
const contentCheck = async (hostAPI, classifiersUsed, node) => {
  const innerText = node.innerText
  if (innerText.trim() === '') {
    // some sites dump their cookie notices into iframes
    const iframes = node.querySelectorAll('iframe')
    for (const iframe of iframes) {
      const innerText = await hostAPI.extractFrameText(iframe)
      if (innerText.trim() === '') {
        continue
      }
      const { classifier, classification } = await hostAPI.classifyCookieNoticeText(innerText)
      classifiersUsed.add(classifier)
      if (classification) {
        return true
      }
    }
    return false
  }
  const { classifier, classification } = await hostAPI.classifyCookieNoticeText(node.innerText)
  classifiersUsed.add(classifier)
  return classification
}

/**
 * Given a "minimum viable cookie notice", i.e. some element that fully contains the text
 * of a cookie notice and nothing further, collect:
 * - the furthest ancestor element that **should** be hidden in addition to the notice (for e.g. overlays)
 * - the furthest ancestor element that **can** be safely hidden without removing important page content
 * - a number representing the tree depth between the previous two elements
 * - any CSS `id`s within the tree between the previous two elements
 */
const expandDetectedCookieNotice = (node) => {
  let outermostHideableElement = node
  let innermostHideableElement = node
  let hideableElementRange = 1
  // Begin by looking upwards in the DOM for the outermost element that _can_ be hidden.
  // When traversing upwards, this is the last element that adds no additional content to the
  // original notice's `innerText`.
  while (outermostHideableElement.parentElement &&
    outermostHideableElement.parentElement.innerText.trim() === node.innerText.trim()) {
    outermostHideableElement = outermostHideableElement.parentElement
    hideableElementRange += 1
    // In the meantime, look for the innermost element that _should_ be hidden.
    // While traversing upwards, this is either the first element, or the last element that has:
    // - full screen dimensions, AND
    // - a blur filter and/or semi-transparent background style
    const style = getComputedStyle(outermostHideableElement)
    const nodeRect = outermostHideableElement.getBoundingClientRect()
    if (nodeRect.left === windowRect.left &&
      nodeRect.right === windowRect.right &&
      nodeRect.top === windowRect.top &&
      nodeRect.bottom === windowRect.bottom &&
      (style.backgroundColor.startsWith('rgba(') ||
      style.backdropFilter !== 'none')) {
      innermostHideableElement = outermostHideableElement
      hideableElementRange = 1
    }
  }

  let n = innermostHideableElement
  const hideableIds = []
  do {
    const id = n.getAttribute('id')
    if (id !== null && id !== '') {
      hideableIds.push(id)
    }
    if (n === outermostHideableElement) {
      break
    }
    n = n.parentElement
  } while (true)
  return {
    innermostHideableElement,
    outermostHideableElement,
    hideableElementRange,
    hideableIds
  }
}

/**
 * This is the main routine that runs within a page and returns information about detected elements.
 * Function dependencies from the host can be accessed via the API exposed by `randomToken`.
 */
export async function inPageRoutine (randomToken, hostOverride) {
  const hostMethods = ['getETLDP1', 'classifyCookieNoticeText', 'extractFrameText']
  const hostAPI = hostMethods.reduce((acc, v) => {
    acc[v] = (...args) => window[randomToken](v, ...args)
    return acc
  }, {})

  const thisHost = hostOverride !== undefined ? hostOverride : new URL(window.location.href).host
  const thisDomain = await hostAPI.getETLDP1(thisHost)

  const classifiersUsed = new Set()

  // Collect cookie notices
  let elements = collectMatchingElements(e => {
    if (e.tagName === 'BODY') {
      return false
    }
    const computedStyle = getComputedStyle(e).position
    return (computedStyle === 'fixed' || computedStyle === 'sticky') && isVisible(e)
  })

  elements = await asyncFilter(elements, e =>
    hasManyFirstPartyLinks(hostAPI.getETLDP1, thisDomain, e)
  )

  elements = nonParentElements(elements)

  elements = await asyncFilter(elements, (node) => contentCheck(hostAPI, classifiersUsed, node))

  const identifiedCookieNotices = elements.map(expandDetectedCookieNotice)

  // Scroll blocking detection
  let scrollBlocked = false
  if (document.querySelectorAll('dialog[open]').length === 0) {
    if (getComputedStyle(document.body).overflowY === 'hidden' ||
      getComputedStyle(document.documentElement).overflowY === 'hidden') {
      scrollBlocked = true
    }
  }

  return {
    cookieNotices: identifiedCookieNotices,
    classifiersUsed: Array.from(classifiersUsed).sort(),
    scrollBlocked,
    url: window.location.href
  }
}
