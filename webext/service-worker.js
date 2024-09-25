import suffixList from './node_modules/@gorhill/publicsuffixlist/publicsuffixlist.js'

let psl

fetch(chrome.runtime.getURL('public_suffix_list.dat'))
  .then(res => res.text())
  .then(text => psl = text)

const inPageAPI = {
  classifyInnerText: async (innerText) => {
    const contentChecks = [
      (e) => {
        return e.match(/cookies/) !== null
      },
      (e) => {
        return e.match(/consent/) !== null
      },
      (e) => {
        return e.match(/privacy/) !== null
      },
      (e) => {
        return e.match(/analytics/) !== null
      },
      (e) => {
        return e.match(/accept/) !== null
      },
      (e) => {
        return e.match(/only necessary/) !== null
      },
      (e) => {
        return e.match(/reject/) !== null
      }
    ]
    for (const contentCheck of contentChecks) {
      if (contentCheck(innerText.toLowerCase())) {
        return true
      }
    }
    return false
  },
  getETLDP1: () => (() => {
    let init
    return (hostname) => {
      if (init === undefined) {
        init = new Promise(resolve => {
          fs.readFile(path.join(import.meta.dirname, '..', 'public_suffix_list.dat'), 'utf8')
            .then(data => {
              suffixList.parse(data, nodeUrl.domainToASCII)
              resolve(true)
            })
        })
      }
      return init.then(() => suffixList.getDomain(hostname))
    }
  })(),
  detected: async () => {
    chrome.action.openPopup()
  },
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension")
    const [name, ...args] = request
    console.log(name + ' called with', JSON.stringify(args))
    inPageAPI[name](...args).then(result => {
      console.log('sending result ', result)
      sendResponse(result)
    })
    return true
  }
)
