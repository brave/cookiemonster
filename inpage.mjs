// This is the main routine that runs within a page and returns information about detected elements.
// This function should be 100% self-contained - puppeteer does not transfer dependencies to the page's JS context.
export function inPageRoutine() {
  function containsMainPageContent(e) {
    //main page content: Content that should not be hidden by a rule in the cookie list. This can be determined using heuristics like the overall size of the HTML tree, the presence of semantic elements like nav or section, the amount of text, etc.
    if (e.querySelector('nav') !== null) {
      return true;
    }
    if (e.querySelector('section') !== null) {
      return true;
    }
    if (e.innerText.length > 10000) {
      return true;
    }
  }

  //document.body.innerText
  //document.body.textContent
  const xpath = "//*[contains(text(), 'cookies')]";
  const results = [];
  const query = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  for (let i = 0, length = query.snapshotLength; i < length; ++i) {
    results.push(query.snapshotItem(i));
  }
  let commonParents;
  for (const result of results) {
    if (result.tagName === 'STYLE' || result.tagName === 'SCRIPT') {
      continue;
    }
    const parentElementChain = [result];
    let parent = result.parentElement;
    while (parent !== null) {
      parentElementChain.push(parent);
      parent = parent.parentElement;
    }
    parentElementChain.reverse();
    console.log(parentElementChain)
    if (commonParents === undefined) {
      commonParents = parentElementChain
    } else {
      for (const i in commonParents) {
        if (parentElementChain.length <= i || parentElementChain[i] !== commonParents[i]) {
          commonParents = commonParents.slice(0, i);
          break;
        }
      }
    }
  }
  const pageRect = document.documentElement.getBoundingClientRect();
  let dialogRootElement;
  console.log(commonParents);
  if (commonParents !== undefined && commonParents.length > 1) {
    // Attempt to find dialog root element within commonParents
    for (const e of commonParents.slice(1)) {
      if (containsMainPageContent(e)) {
        continue;
      }
      eStyle = window.getComputedStyle(e);
      rect = e.getBoundingClientRect();
      // full-page overlay?
      if (rect.width == pageRect.width && rect.height == pageRect.height &&
          e.childElementCount === 1 &&
          (eStyle.getPropertyValue('opacity') < 1 ||
          // background-color returns `rgb(_,_,_)` if non-transparent, `rgba(_,_,_,_)` otherwise.
          (eStyle.getPropertyValue('background-color').match(/,/g) || []).length == 3 )) {
        // this might be the correct element
        dialogRootElement = e;
        break;
      } else {
        // significantly smaller in size than the visible document window's dimensions?
        const rect = e.getBoundingClientRect();
        if (rect.width * rect.height < 0.5 * pageRect.width * pageRect.height) {
          // this might be the correct element
          dialogRootElement = e;
          break;
        }
      }
    }
  }
  return dialogRootElement;
}
