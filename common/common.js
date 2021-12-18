/* globals chrome */

// Manifest v2 polyfill
if (chrome.runtime.getManifest().manifest_version === 2) {
  chrome.action = chrome.browserAction

  chrome.storage.sync = {
    get: (...args) =>
      new Promise((resolve) => chrome.storage.local.get(...args, resolve)),
    set: (...args) =>
      new Promise((resolve) => chrome.storage.local.set(...args, resolve)),
  }
}

const Common = {
  modalTypes: [
    'offer',
    'paywall',
    'email',
    'signup',
    'consent',
    'donate',
    'message',
  ],

  $:
    typeof window !== 'undefined'
      ? document.querySelector.bind(document)
      : () => {},
  $$:
    typeof window !== 'undefined'
      ? document.querySelectorAll.bind(document)
      : () => {},

  isObject(object) {
    return typeof object === 'object' && object && !Array.isArray(object)
  },

  arrayify(item) {
    return Array.isArray(item) ? item : [item]
  },

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

  tokenify(string) {
    const tokens = []

    let level = 0
    let token = ''

    string.split('').forEach((char) => {
      token += char

      if (token === 'if ') {
        token = ''
      }

      switch (char) {
        case '(':
          level++

          break
        case ')':
          level--

          if (!level) {
            const [, func, arg] = token.trim().match(/([^(]+)\((.+)\)$/)

            if (!Common.Functions[func]) {
              throw new Error(`Function does not exist: ${func}`)
            }

            try {
              Common.Functions[func](arg)
            } catch (error) {
              throw new Error(`Invalid argument: ${arg}`)
            }

            tokens.push({ func, arg })

            token = ''
          }

          break
      }
    })

    return tokens
  },

  transformDefinitions(definitionsByType) {
    return Object.values(
      definitionsByType.reduce((definitionsByGlob, { type, definitions }) => {
        if (!Common.isObject(definitions)) {
          throw new TypeError(
            `Unexpected definitions type, expected object: ${definitions}`
          )
        }

        Object.keys(definitions).forEach((glob) => {
          definitionsByGlob[glob] = definitionsByGlob[glob] || {
            glob,
            regExps: Common.globToRegExp(glob),
            definitions: [],
          }

          definitionsByGlob[glob].definitions.push(
            ...Common.arrayify(definitions[glob])
              .map((definition) => {
                try {
                  if (!Common.isObject(definition)) {
                    throw new TypeError(
                      `Unexpected definition type, expected object: ${definition}`
                    )
                  }

                  return Object.keys(definition).map((key) => {
                    const conditions = key.startsWith('if ')
                      ? Common.tokenify(key)
                      : null

                    if (conditions && !conditions.length) {
                      throw new Error(`Invalid condition: ${key}`)
                    }

                    let actions = []

                    if (conditions) {
                      if (!Common.isObject(definition[key])) {
                        throw new TypeError(
                          `Invalid actions type, expected object: ${definition[key]}`
                        )
                      }

                      actions = Object.keys(definition[key]).map(
                        (selector) => ({
                          selector,
                          action: definition[key][selector],
                        })
                      )
                    } else {
                      actions = [{ selector: key, action: definition[key] }]
                    }

                    actions = actions.map(({ selector, action }) => {
                      if (typeof action !== 'string') {
                        throw new TypeError(
                          `Unexpected action type, expected string`
                        )
                      }

                      const [func, ...args] = action.split(' ')

                      return { selector, func, args }
                    })

                    actions.forEach(({ selector, func, args }) => {
                      try {
                        Common.$(selector)
                      } catch (error) {
                        throw new Error(`Invalid action selector: ${selector}`)
                      }

                      if (!Common.Actions[func]) {
                        throw new Error(`Invalid action function: ${func}`)
                      }
                    })

                    return { type, conditions: conditions || [], actions }
                  })
                } catch (error) {
                  throw new Error(`${error.message || error} in ${glob}`)
                }
              })
              .flat()
          )
        })

        return definitionsByGlob
      }, {})
    ).flat()
  },

  globToRegExp(glob) {
    const globs = glob.split(' ')

    return globs.map((glob) => {
      try {
        if (glob !== '*') {
          if (!glob.includes('.')) {
            throw new Error('Invalid glob')
          }

          // eslint-disable-next-line no-new
          new URL(`https://${glob.replace('*', 'test')}`)
        }

        return new RegExp(
          glob === '*'
            ? '^https?://.+'
            : `^https?://${glob.replace('.', '\\.').replace('*', '[^./]+')}\\b`
        ).source
      } catch (error) {
        throw new Error(`Invalid URL pattern: ${glob}`)
      }
    })
  },

  Actions: {
    remove() {
      this.remove()
    },
    addClass(...args) {
      this.classList.add(...args)
    },
    removeClass(...args) {
      if (args[0] === '*') {
        this.className = ''
      } else {
        this.classList.remove(...args)
      }
    },
  },

  Functions: {
    $(selector) {
      try {
        return !!Common.$(selector)
      } catch (error) {
        throw new Error(`Invalid selector: ${selector}`)
      }
    },
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
