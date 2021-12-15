/* eslint-env browser */
/* globals chrome, Common */

const { $, debounce, Background } = Common

const definitions = []

const blockedModals = {}

// Functions that can be called from the popup script
const Content = {
  getBlockedModals() {
    return blockedModals
  },

  getUrl() {
    return window.location.href
  },

  reload() {
    window.location.reload()
  },

  async isAllowed(url = window.location.href) {
    // Check if hostname is in allow list
    const { allowList } = await chrome.storage.sync.get({
      allowList: [],
    })

    let { hostname } = new URL(url)

    hostname = hostname.replace(/^www\./, '')

    return allowList.includes(hostname)
  },
}

const Functions = {
  $(selector) {
    return !!$(selector)
  },
}

// Log messages in the background script console
function log(...messages) {
  const error = messages[0]

  if (error instanceof Error) {
    Background.call('error', error.toString(), error.stack)
  } else {
    Background.call('log', ...messages)
  }
}

const run = async () => {
  try {
    if (await Content.isAllowed()) {
      return
    }

    definitions.forEach((definition) => {
      const { type, conditions, actions, completed } = definition

      if (
        completed ||
        !conditions.every(({ func, arg }) => {
          if (Functions.func) {
            throw new Error(`Function does not exist: Functions.${func}`)
          }

          return Functions[func](arg)
        })
      ) {
        return
      }

      let found = false

      actions.forEach(({ selector, action }) => {
        const node = $(selector)

        if (node) {
          found = true

          const [func, ...args] = action.split(' ')

          log(`action: ${selector}: ${func}(${args.join(', ')})`)

          switch (func) {
            case 'remove':
              node.remove()

              break
            case 'addClass':
              node.classList.add(...args)

              break
            case 'removeClass':
              if (args[0] === '*') {
                node.className = ''
              } else {
                node.classList.remove(...args)
              }

              break
            default:
              log(new Error(`Unknown function ${func}(${args.join(', ')})`))
          }
        }
      })

      if (found) {
        definition.completed = true

        blockedModals[type] = (blockedModals[type] || 0) + 1

        Background.call(
          'setBadge',
          Object.values(blockedModals).reduce((sum, value) => sum + value, 0)
        )

        // Update all-time totals
        chrome.storage.sync
          .get({
            blockedModals: {},
          })
          .then(({ blockedModals }) => {
            blockedModals[type] = (blockedModals[type] || 0) + 1

            chrome.storage.sync.set({ blockedModals })
          })
      }
    })
  } catch (error) {
    log(error)
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { func } = request

  if (func) {
    const args = request.args || []

    Promise.resolve(Content[func].call({ request, sender }, ...args))
      .then((response) => {
        // eslint-disable-next-line no-console
        log(`popup: ${func}(${args.join(', ')})`, response)

        sendResponse(response)
      })
      .catch((error) => log(error))
  }

  return true
})

//
;(async () => {
  try {
    definitions.push(
      ...(await Background.call('getDefinitions', location.href))
    )

    const runDebounced = debounce(() => run(), 100)

    const mutationObserver = new MutationObserver(() => runDebounced())

    mutationObserver.observe(document.body, { subtree: true, childList: true })

    run()
  } catch (error) {
    log(error)
  }
})()
