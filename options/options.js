/* globals chrome, Common */

const { $, i18n, el, capitalize, modalTypes } = Common

i18n()

//
;(async () => {
  const { optionBlockModalTypes } = await chrome.storage.sync.get({
    optionBlockModalTypes: modalTypes.reduce(
      (options, type) => ({ ...options, [type]: true }),
      {}
    ),
  })

  modalTypes.forEach((type) => {
    const div1 = el('div')
    const label = el('label')
    const checkbox = el('input')
    const div2 = el('div')

    div1.className = 'checkbox'

    checkbox.type = 'checkbox'

    checkbox.checked = optionBlockModalTypes[type]

    checkbox.addEventListener('change', () => {
      optionBlockModalTypes[type] = checkbox.checked

      chrome.storage.sync.set({ optionBlockModalTypes })
    })

    div2.textContent = chrome.i18n.getMessage(
      `modalType${capitalize(type)}Help`
    )

    div2.className = 'help'

    label.append(
      checkbox,
      chrome.i18n.getMessage(`modalType${capitalize(type)}`)
    )

    div1.append(label, div2)

    $('#modal-types').append(div1)
  })
})()
