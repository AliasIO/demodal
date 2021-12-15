/* globals chrome */

const Common = {
  $: document.querySelector.bind(document),
  $$: document.querySelectorAll.bind(document),

  debounce(func, wait) {
    let timeout

    return (...args) => {
      const debounced = () => {
        clearTimeout(timeout)

        func(...args)
      }

      clearTimeout(timeout)

      timeout = setTimeout(debounced, wait)
    }
  },

  i18n() {
    const elements = Common.$$('[data-i18n]')

    elements.forEach((element) => {
      element.textContent = chrome.i18n.getMessage(element.dataset.i18n)
    })
  },

  capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
  },

  removeChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  },

  el(name) {
    return document.createElement(name)
  },

  getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
        resolve(tabs[0])
      )
    })
  },

  Background: {
    call(func, ...args) {
      return new Promise((resolve, reject) =>
        chrome.runtime.sendMessage({ func, args }, (response) =>
          chrome.runtime.lastError
            ? reject(new Error(chrome.runtime.lastError.message))
            : resolve(response)
        )
      )
    },
  },

  Content: {
    call(func, ...args) {
      return new Promise((resolve, reject) =>
        Common.getActiveTab().then((tab) =>
          chrome.tabs.sendMessage(tab.id, { func, args }, (response) =>
            chrome.runtime.lastError
              ? reject(new Error(chrome.runtime.lastError.message))
              : resolve(response)
          )
        )
      )
    },
  },
}
