/* globals chrome */

const modalTypes = []

const $ = document.querySelector.bind(document)
const $$ = document.querySelectorAll.bind(document)

function i18n() {
  const elements = $$('[data-i18n]')

  elements.forEach((element) => {
    element.textContent = chrome.i18n.getMessage(element.dataset.i18n)
  })
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

function removeChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}

function el(name) {
  return document.createElement(name)
}

function renderTotals(prefix, totals) {
  let any = false

  removeChildren($(`${prefix}__stats tbody`))

  modalTypes.forEach((type) => {
    const tr = el('tr')
    const td1 = el('td')
    const td2 = el('td')

    if (totals[type]) {
      td1.textContent = chrome.i18n.getMessage(`modalType${capitalize(type)}`)
      td2.textContent = totals[type]

      tr.appendChild(td1)
      tr.appendChild(td2)
      $(`${prefix}__stats tbody`).appendChild(tr)

      any = true
    }
  })

  if (any) {
    $(`${prefix}__stats`).classList.remove('hidden')
    $(`${prefix}__missing`).classList.add('hidden')
  }
}

const Background = {
  call(func, ...args) {
    return new Promise((resolve, reject) =>
      chrome.runtime.sendMessage({ func, args }, (response) =>
        chrome.runtime.lastError
          ? reject(new Error(chrome.runtime.lastError.message))
          : resolve(response)
      )
    )
  },
}

const Content = {
  call(func, ...args) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
        chrome.tabs.sendMessage(tabs[0].id, { func, args }, (response) =>
          chrome.runtime.lastError
            ? reject(new Error(chrome.runtime.lastError.message))
            : resolve(response)
        )
      )
    })
  },
}

i18n()

//
;(async () => {
  $('.content').classList.remove('visible')

  $(`#blocked-page__stats`).classList.add('hidden')
  $(`#blocked-page__missing`).classList.remove('hidden')
  $(`#blocked-total__stats`).classList.add('hidden')
  $(`#blocked-total__missing`).classList.remove('hidden')

  modalTypes.push(...(await Background.call('getModalTypes')))

  // Show all-time totals
  const { blockedModals: totals } = await chrome.storage.sync.get({
    blockedModals: {},
  })

  renderTotals('#blocked-total', totals)

  let connected = true

  let blockedModals = {}

  try {
    // Show page totals
    blockedModals = await Content.call('getBlockedModals')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)

    connected = false
  }

  $('#options').classList[connected ? 'remove' : 'add']('hidden')

  renderTotals('#blocked-page', blockedModals)

  $('.content').classList.add('visible')
})()
