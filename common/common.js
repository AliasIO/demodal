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

  async tokenify(string) {
    const tokens = []

    let bracketLevel = 0
    let quote = false
    let token = ''

    for (const char of string.split('')) {
      token += char

      if (token === 'if ') {
        token = ''
      }

      switch (char) {
        case "'":
          quote = !quote

          if (!quote) {
            tokens.push(token.replace(/(^'|'$)/g, ''))

            token = ''
          }

          break
        case '(':
          if (!quote) {
            bracketLevel++
          }

          break
        case ')':
          if (!quote) {
            bracketLevel--

            if (!bracketLevel) {
              const [, func, arg] = token.trim().match(/([^(]+)\((.+)\)$/)

              if (!Common.Functions[func]) {
                throw new Error(`Function does not exist: ${func}`)
              }

              try {
                await Common.Functions[func].call({ validateOnly: true }, arg)
              } catch (error) {
                throw new Error(`Invalid argument: ${arg}`)
              }

              tokens.push({ func, arg })

              token = ''
            }
          }

          break
      }
    }

    if (token) {
      tokens.push(token)
    }

    return tokens
  },

  async transformDefinitions(definitionsByType) {
    const definitionsByGlob = []

    for (const { type, definitions } of definitionsByType) {
      if (!Common.isObject(definitions)) {
        throw new TypeError(
          `Unexpected definitions type, expected object: ${definitions}`
        )
      }

      for (const glob of Object.keys(definitions)) {
        definitionsByGlob[glob] = definitionsByGlob[glob] || {
          glob,
          regExps: Common.globToRegExp(glob),
          definitions: [],
        }

        definitionsByGlob[glob].definitions.push(
          ...(
            await Promise.all(
              Common.arrayify(definitions[glob]).map((definition) => {
                try {
                  if (!Common.isObject(definition)) {
                    throw new TypeError(
                      `Unexpected definition type, expected object: ${definition}`
                    )
                  }

                  return Promise.all(
                    Object.keys(definition).map(async (key) => {
                      const conditions = key.startsWith('if ')
                        ? await Common.tokenify(key)
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

                      actions = await Promise.all(
                        actions.map(async ({ selector, action }) => {
                          if (typeof action !== 'string') {
                            throw new TypeError(
                              `Unexpected action type, expected string`
                            )
                          }

                          const [func, ...splitArgs] = action.split(' ')

                          const args = await Common.tokenify(
                            splitArgs.join(' ')
                          )

                          return { selector, func, args }
                        })
                      )

                      actions.forEach(({ selector, func, args }) => {
                        try {
                          Common.$(selector)
                        } catch (error) {
                          throw new Error(
                            `Invalid action selector: ${selector}`
                          )
                        }

                        if (!Common.Actions[func]) {
                          throw new Error(`Invalid action function: ${func}`)
                        }
                      })

                      return { type, conditions: conditions || [], actions }
                    })
                  )
                } catch (error) {
                  throw new Error(`${error.message || error} in ${glob}`)
                }
              })
            )
          ).flat()
        )
      }
    }

    return Object.values(definitionsByGlob).flat()
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

  // Run a script in the context of the page
  inject(func, ...args) {
    return new Promise((resolve) => {
      const script = Common.el('script')

      script.src = chrome.runtime.getURL('inject/inject.js')

      script.dataset.demodal = 'true'

      script.onload = () => {
        const receiveMessage = ({ data }) => {
          const { demodalResponse: message } = data
          if (!message) {
            return
          }

          window.removeEventListener('message', receiveMessage)

          script.remove()

          resolve(message)
        }

        window.addEventListener('message', receiveMessage)

        window.postMessage({ demodalRequest: { func, args } })
      }

      document.body.append(script)
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
    addStyle(...args) {
      this.style = `${this.style}; ${args[0]}`
    },
    removeStyle() {
      this.style = ''
    },
    call(...args) {
      return Common.inject('call', ...args)
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
    async defined(...args) {
      if (this.validateOnly) {
        return true
      }

      return await Common.inject('defined', ...args)
    },
    sleep(ms = 0) {
      if (this.validateOnly) {
        return true
      }

      return new Promise((resolve) =>
        setTimeout(() => resolve(true), parseInt(ms, 10))
      )
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
