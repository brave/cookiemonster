/* eslint-env browser */

// This is the main routine that runs within a page and returns information about detected elements.
// This function should be 100% self-contained - puppeteer does not transfer dependencies to the page's JS context.
// Function dependencies can be exposed and accessed via the API exposed by `randomToken`.
export async function inPageRoutine (randomToken, hostOverride) {
  /* TODO: never used
  function containsMainPageContent (e) {
    // main page content: Content that should not be hidden by a rule in the cookie list. This can be determined using heuristics like the overall size of the HTML tree, the presence of semantic elements like nav or section, the amount of text, etc.
    if (e.querySelector('nav') !== null) {
      return true
    }
    if (e.querySelector('section') !== null) {
      return true
    }
    if (e.innerText.toLowerCase().length > 10000) {
      return true
    }
  }
  */

  const hostAPI = ['getETLDP1', 'classifyInnerText', 'extractFrameText'].reduce((acc, v) => {
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

  const asyncFilter = async (arr, predicate) => Promise.all(arr.map(predicate))
    .then((results) => arr.filter((_v, index) => results[index]))

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

  const uncontainedElements = []
  if (linkCheckedElements.length > 0) {
    for (let i = linkCheckedElements.length - 1; i >= 0; i--) {
      let contained = false
      for (let j = 0; j < linkCheckedElements.length; j++) {
        if (i !== j && linkCheckedElements[j].contains(linkCheckedElements[i])) {
          contained = true
          break
        }
      }
      if (!contained) {
        uncontainedElements.push(linkCheckedElements[i])
      }
    }
  }

  const classifiersUsed = new Set()
  const contentCheckedElements = await asyncFilter(uncontainedElements, async node => {
    const innerText = node.innerText
    if (innerText.trim() === '') {
      // some sites dump their cookie notices into iframes
      const iframes = node.querySelectorAll('iframe')
      for (const iframe of iframes) {
        const innerText = await hostAPI.extractFrameText(iframe)
        if (innerText.trim() === '') {
          continue;
        }
        const { classifier, classification } = await hostAPI.classifyInnerText(innerText)
        classifiersUsed.add(classifier)
        if (classification) {
          return true
        }
      }
      return false
    }
    const { classifier, classification } = await hostAPI.classifyInnerText(node.innerText)
    classifiersUsed.add(classifier)
    return classification
  })

  // Scroll blocking detection
  let scrollBlocked = false
  if (document.querySelectorAll('dialog[open]').length === 0) {
    if (getComputedStyle(document.body).overflowY === 'hidden') {
      scrollBlocked = true
    }
  }

  return {
    elements: contentCheckedElements,
    classifiersUsed: Array.from(classifiersUsed).sort(),
    scrollBlocked
  }
}
