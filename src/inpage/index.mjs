/* eslint-env browser */

const asyncFilter = async (arr, predicate) => Promise.all(arr.map(predicate))
  .then((results) => arr.filter((_v, index) => results[index]))

// This is the main routine that runs within a page and returns information about detected elements.
// Function dependencies from the host can be exposed and accessed via the API exposed by `randomToken`.
export async function inPageRoutine (randomToken, hostOverride) {
  const hostAPI = ['getETLDP1', 'classifyCookieNoticeText', 'extractFrameText'].reduce((acc, v) => {
    acc[v] = (...args) => window[randomToken](v, ...args)
    return acc
  }, {})

  const fixedPositionElements = []
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_ELEMENT,
    el => {
      if (el.tagName === 'BODY') {
        return NodeFilter.FILTER_SKIP
      }
      const computedStyle = getComputedStyle(el).position
      return (computedStyle === 'fixed' || computedStyle === 'sticky')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    }
  )
  while (walker.nextNode()) {
    if (walker.currentNode.checkVisibility && walker.currentNode.checkVisibility()) {
      fixedPositionElements.push(walker.currentNode)
    }
  }

  const windowRect = {
    left: 0,
    right: window.innerWidth,
    top: 0,
    bottom: window.innerHeight
  }

  const visibleElements = fixedPositionElements.filter(node => {
    const nodeRect = node.getBoundingClientRect()
    if (nodeRect.left >= windowRect.right ||
        nodeRect.right <= windowRect.left ||
        nodeRect.top >= windowRect.bottom ||
        nodeRect.bottom <= windowRect.top) {
      return false
    }
    return true
  })

  // filter out elements which contain a lot of predominantly first-party links
  const thisHost = hostOverride !== undefined ? hostOverride : new URL(window.location.href).host
  const thisDomain = await hostAPI.getETLDP1(thisHost)
  const linkCheckedElements = await asyncFilter(visibleElements, async e => {
    const linkPartiness = await Promise.all(Array.from(e.querySelectorAll('a[href]')).map(async a => {
      const linkETLDP1 = await hostAPI.getETLDP1(new URL(a.href).host)
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
  })

  const nonParentElements = []
  if (linkCheckedElements.length > 0) {
    for (let i = linkCheckedElements.length - 1; i >= 0; i--) {
      let container = false
      for (let j = 0; j < linkCheckedElements.length; j++) {
        if (i !== j && linkCheckedElements[i].contains(linkCheckedElements[j])) {
          container = true
          break
        }
      }
      if (!container) {
        nonParentElements.push(linkCheckedElements[i])
      }
    }
  }

  const classifiersUsed = new Set()
  const contentCheckedElements = await asyncFilter(nonParentElements, async node => {
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
  })

  // Elements in `contentCheckedElements` constitute "minimum viable cookie notices".
  // However, their parent elements may also be eligible for hiding:
  // - parent elements with no other significant content **can** be safely hidden
  // - parent elements with a full-page overlay **should** be hidden in addition to the notice
  const identifiedCookieNotices = []
  for (const node of contentCheckedElements) {
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

    const identifiedNotice = {
      innermostHideableElement,
      outermostHideableElement,
      hideableElementRange
    }
    identifiedCookieNotices.push(identifiedNotice)
  }

  // Scroll blocking detection
  let scrollBlocked = false
  if (document.querySelectorAll('dialog[open]').length === 0) {
    if (getComputedStyle(document.body).overflowY === 'hidden') {
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
