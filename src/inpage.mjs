// This is the main routine that runs within a page and returns information about detected elements.
// This function should be 100% self-contained - puppeteer does not transfer dependencies to the page's JS context.
export function inPageRoutine () {
  function containsMainPageContent (e) {
    // main page content: Content that should not be hidden by a rule in the cookie list. This can be determined using heuristics like the overall size of the HTML tree, the presence of semantic elements like nav or section, the amount of text, etc.
    if (e.querySelector('nav') !== null) {
      return true
    }
    if (e.querySelector('section') !== null) {
      return true
    }
    if (e.innerText.length > 10000) {
      return true
    }
  }

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
      return e.innerText.match(/cookies/) !== null
    },
    (e) => {
      return e.innerText.match(/consent/) !== null
    },
    (e) => {
      return e.innerText.match(/privacy/) !== null
    },
    (e) => {
      return e.innerText.match(/experience/) !== null
    },
    (e) => {
      return e.innerText.match(/analytics/) !== null
    },
    (e) => {
      return e.innerText.match(/accept/) !== null
    },
    (e) => {
      return e.innerText.match(/only necessary/) !== null
    },
    (e) => {
      return e.innerText.match(/reject/) !== null
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

  if (visibleElements.length === 1) {
    return visibleElements[0]
  } else if (visibleElements.length === 0) {
    return undefined
  } else {
    return visibleElements
  }
}
