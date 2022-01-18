/* eslint-env browser */
/* globals chrome, Common */

const { $, debounce, Background, Actions, Functions } = Common

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

    await Promise.all(
      definitions.map(async (definition) => {
        const { type, conditions, actions, completed } = definition

        if (
          completed ||
          !(
            await Promise.all(
              conditions.map(({ func, arg }) => Functions[func](arg))
            )
          ).every((result) => result)
        ) {
          return
        }

        let found = false

        actions.forEach(({ selector, func, args }) => {
          let success = false

          switch (func) {
            case 'call':
              success = Actions[func](selector, ...args)

              break
            default:
              // eslint-disable-next-line no-case-declarations
              const node = $(selector)

              if (node) {
                success = Actions[func].call(node, ...args)
              }
          }

          if (success) {
            log(`action: ${selector}: ${func}(${args.join(', ')})`)
          }

          found = found || success
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
    )
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
    definitions.push(...(await Background.call('getDefinitions')))

    const runDebounced = debounce(() => run(), 500)

    const mutationObserver = new MutationObserver((mutations) => {
      // Avoid infinite loop if mutation was done by us
      if (
        mutations.every((mutation) =>
          Array.from(mutation.addedNodes).every((node) => node.dataset.demodal)
        )
      ) {
        return
      }

      runDebounced()
    })

    mutationObserver.observe(document.body, { subtree: true, childList: true })

    run()
  } catch (error) {
    log(error)
  }
})()
