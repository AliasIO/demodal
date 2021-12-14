/* globals chrome */

const modalTypes = [
  'offer',
  'paywall',
  'email',
  'signup',
  'consent',
  'donate',
  'message',
]

const definitions = []

function arrayify(item) {
  return Array.isArray(item) ? item : [item]
}

function tokenify(string) {
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

          tokens.push({ func, arg })

          token = ''
        }

        break
    }
  })

  return tokens
}

function globToRegExp(glob) {
  return glob
    .split(' ')
    .map(
      (glob) =>
        new RegExp(
          glob === '*'
            ? ''
            : `^https?://${glob.replace('.', '\\.').replace('*', '[^./]+')}\\b`,
          'i'
        )
    )
}

function transformDefinitions(definitionsByType) {
  return Object.values(
    definitionsByType.reduce((definitionsByGlob, { type, definitions }) => {
      Object.keys(definitions).forEach((glob) => {
        definitionsByGlob[glob] = definitionsByGlob[glob] || {
          glob,
          regExps: globToRegExp(glob),
          definitions: [],
        }

        definitionsByGlob[glob].definitions.push(
          ...arrayify(definitions[glob])
            .map((definition) =>
              Object.keys(definition).map((key) => {
                const conditions = key.startsWith('if ') ? tokenify(key) : []

                const actions = conditions.length
                  ? Object.keys(definition[key]).map((selector) => ({
                      selector,
                      action: definition[key][selector],
                    }))
                  : [{ selector: key, action: definition[key] }]

                return { type, conditions, actions }
              })
            )
            .flat()
        )
      })

      return definitionsByGlob
    }, {})
  ).flat()
}

async function loadDefinitions() {
  definitions.push(
    ...transformDefinitions(
      await Promise.all(
        modalTypes.map(async (type) => ({
          type,
          definitions: JSON.parse(
            await (
              await fetch(chrome.runtime.getURL(`../definitions/${type}.json`))
            ).text()
          ),
        }))
      )
    )
  )
}

const Background = {
  getDefinitions(url) {
    return definitions
      .filter(({ regExps }) =>
        regExps.some((regExp) => regExp.test(url) || regExp.test(`www.${url}`))
      )
      .map(({ definitions }) => definitions)
      .flat()
  },

  getModalTypes() {
    return modalTypes
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
          console.log(`content:`, { func, args, response })

          sendResponse(response)
        })
        .catch((error) => Background.error(error))
    }
  }

  return true
})

loadDefinitions()

chrome.action.setBadgeBackgroundColor({
  color: '#0068b3',
})
