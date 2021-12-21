/* eslint-env browser */

;(function () {
  try {
    const chainToProp = (chain) => {
      return chain
        .split('.')
        .reduce(
          (value, method) =>
            value &&
            value instanceof Object &&
            Object.prototype.hasOwnProperty.call(value, method)
              ? value[method]
              : undefined,
          window
        )
    }

    const Functions = {
      defined(chain) {
        return chainToProp(chain) !== undefined
      },
      call(chain, ...args) {
        chainToProp(chain)(...args)
      },
    }

    const receiveMessage = ({ data }) => {
      const { demodalRequest: message } = data
      if (!message) {
        return
      }

      const { func, args } = message

      removeEventListener('message', receiveMessage)

      if (func && Functions[func]) {
        postMessage({
          demodalResponse: Functions[func](...(args || [])),
        })
      }
    }

    addEventListener('message', receiveMessage)
  } catch (error) {
    // Fail quietly
  }
})()
