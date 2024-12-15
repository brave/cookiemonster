/* eslint-env browser */

// The main routine that runs within a page to detect cookie consent notices via HTML analysis
const inPageRoutine = async (randomToken, hostOverride) => {
  const hostAPI = ['getETLDP1', 'extractFrameText'].reduce((acc, v) => {
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
    .then((results) => {
      return arr.filter((_v, index) => results[index])
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

  // Extract text from an element, including any iframes
  async function getElementText (element) {
    let text = element.innerText || ''

    if (text.trim() === '') {
      const iframes = element.querySelectorAll('iframe')
      for (const iframe of iframes) {
        const innerText = await hostAPI.extractFrameText(iframe)
        if (innerText.trim() === '') {
          continue
        }
        text = innerText
      }
    }

    return text.trim()
  }

  const candidateElements = await asyncFilter(uncontainedElements, async node => {
    const text = await getElementText(node)
    if (!text) return false

    return node
  })

  return candidateElements
}

export async function extract (page, { randomToken, hostOverride }) {
  const inPageResult = await page.evaluateHandle(inPageRoutine, randomToken, hostOverride)
  return inPageResult
}
