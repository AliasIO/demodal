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
        chainToProp(chain)?.(...args)
      },
    }

    const receiveMessage = ({ data: { demodalRequest } }) => {
      if (!demodalRequest) {
        return
      }

      const { func, args, uid } = demodalRequest

      removeEventListener('message', receiveMessage)

      postMessage({
        demodalResponse: {
          uid,
          message:
            func && Functions[func] ? Functions[func](...(args || [])) : false,
        },
      })
    }

    addEventListener('message', receiveMessage)
  } catch (error) {
    // Fail quietly
  }
})()
