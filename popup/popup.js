/* globals chrome */

const Content = {
  call(func, ...args) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
        chrome.tabs.sendMessage(tabs[0].id, { func, args }, resolve)
      )
    })
  },
}

//
;(async () => {
  const blockedModals = await Content.call('getBlockedModals')

  document.body.innerHTML = JSON.stringify(blockedModals, null, 2)
})()
