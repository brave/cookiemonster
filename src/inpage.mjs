/* eslint-env browser */

// This is the main routine that runs within a page and returns information about detected elements.
// This function should be 100% self-contained - puppeteer does not transfer dependencies to the page's JS context.
export function inPageRoutine (hostOverride) {
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

  const fixedPositionElements = []
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_ELEMENT,
    el => {
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

  const contentChecks = [
    (e) => {
      return e.innerText.toLowerCase().match(/cookies/) !== null
    },
    (e) => {
      return e.innerText.toLowerCase().match(/consent/) !== null
    },
    (e) => {
      return e.innerText.toLowerCase().match(/privacy/) !== null
    },
    (e) => {
      return e.innerText.toLowerCase().match(/analytics/) !== null
    },
    (e) => {
      return e.innerText.toLowerCase().match(/accept/) !== null
    },
    (e) => {
      return e.innerText.toLowerCase().match(/only necessary/) !== null
    },
    (e) => {
      return e.innerText.toLowerCase().match(/reject/) !== null
    }
  ]
  const contentCheckedElements = fixedPositionElements.filter(node => {
    for (const contentCheck of contentChecks) {
      if (contentCheck(node)) {
        return true
      }
    }
    return false
  })

  const documentRect = document.documentElement.getBoundingClientRect()

  const visibleElements = contentCheckedElements.filter(node => {
    const nodeRect = node.getBoundingClientRect()
    if (nodeRect.left >= documentRect.right ||
        nodeRect.right <= documentRect.left ||
        nodeRect.top >= documentRect.bottom ||
        nodeRect.bottom <= documentRect.top) {
      return false
    }
    return true
  })

  // filter out elements which contain a lot of predominantly first-party links
  let thisHost = hostOverride !== undefined ? hostOverride : new URL(window.location.href).host
  if (thisHost.startsWith('www.')) {
    thisHost = thisHost.substring(4)
  }
  const candidateElements = visibleElements.filter(e => {
    const linkPartiness = Array.from(e.querySelectorAll('a[href]')).map(a => {
      try {
        const url = new URL(a.href)
        const linkHost = url.host.startsWith('www.') ? url.host.substring(4) : url.host
        return linkHost === thisHost
      } catch (e) {
        return undefined
      }
    })
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

  if (candidateElements.length === 1) {
    return candidateElements[0]
  } else if (candidateElements.length === 0) {
    return undefined
  } else {
    return candidateElements
  }
}
