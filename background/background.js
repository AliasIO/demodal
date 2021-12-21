/* globals chrome, importScripts, Common */

if (typeof importScripts !== 'undefined') {
  importScripts(chrome.runtime.getURL(`common/common.js`))
}

const { modalTypes, transformDefinitions } = Common

const definitions = []

async function loadDefinitions() {
  try {
    definitions.push(
      ...(await transformDefinitions(
        await Promise.all(
          modalTypes.map(async (type) => ({
            type,
            definitions: JSON.parse(
              await (
                await fetch(chrome.runtime.getURL(`definitions/${type}.json`))
              ).text()
            ),
          }))
        )
      ))
    )
  } catch (error) {
    Background.error(error)
  }
}

const Background = {
  async getDefinitions() {
    const url = this.sender.tab.url

    // Get custom definitions
    const { customDefinitions: definitionsByType } =
      await chrome.storage.sync.get({
        customDefinitions: {},
      })

    const customDefinitions = await transformDefinitions(
      modalTypes.map((type) => ({
        type,
        definitions: definitionsByType[type] || {},
      }))
    )

    return [...definitions, ...customDefinitions]
      .filter(({ regExps }) =>
        regExps.some((_regExp) => {
          const regExp = new RegExp(_regExp, 'i')

          return regExp.test(url) || regExp.test(`www.${url}`)
        })
      )
      .map(({ definitions }) => definitions)
      .flat()
  },

  setBadge(text) {
    return chrome.action.setBadgeText({
      text: String(text),
      tabId: this.sender.tab.id,
    })
  },

  log(...args) {
    // eslint-disable-next-line no-console
    console.log(...args)
  },

  error(error) {
    // eslint-disable-next-line no-console
    console.error(error)
  },
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { func } = request

  if (func) {
    const args = request.args || []

    if (request.func === 'log') {
      // eslint-disable-next-line no-console
      console.log('content:', ...args)
    } else if (request.func === 'error') {
      const [message, stack] = args

      const error = new Error(`content: ${message}`)

      error.stack = stack

      Background.error(error)
    } else {
      Promise.resolve(Background[func].call({ request, sender }, ...args))
        .then((response) => {
          // eslint-disable-next-line no-console
          console.log(`content: ${func}(${args.join(', ')})`, response)

          sendResponse(response)
        })
        .catch((error) => Background.error(error))
    }
  }

  return true
})

chrome.action.setBadgeBackgroundColor({
  color: '#4755b3',
})

loadDefinitions().then(() =>
  // eslint-disable-next-line no-console
  console.log(`init ok: ${definitions.length} definitions`)
)
