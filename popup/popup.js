/* globals chrome, Common */

const {
  $,
  $$,
  i18n,
  capitalize,
  removeChildren,
  el,
  debounce,
  modalTypes,
  transformDefinitions,
  Content,
} = Common

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

i18n()

//
;(async () => {
  $('.content').classList.remove('visible')

  $(`#blocked-page__stats`).classList.add('hidden')
  $(`#blocked-page__missing`).classList.remove('hidden')
  $(`#blocked-total__stats`).classList.add('hidden')
  $(`#blocked-total__missing`).classList.remove('hidden')

  $$('.tab').forEach((tab) =>
    tab.addEventListener('click', (e) => {
      $$('.tab').forEach((tab) => tab.classList.remove('tab--active'))

      e.target.classList.add('tab--active')

      $$('[data-tab-content]').forEach((tabContent) =>
        tabContent.classList.add('hidden')
      )

      $(`[data-tab-content='${e.target.dataset.tab}']`).classList.remove(
        'hidden'
      )
    })
  )

  // Blocked modals tab

  $('.link-options').addEventListener('click', (e) => {
    e.preventDefault()

    chrome.runtime.openOptionsPage()
  })

  // Show all-time totals
  const { blockedModals: totals } = await chrome.storage.sync.get({
    blockedModals: {},
  })

  renderTotals('#blocked-total', totals)

  let connected = true

  try {
    // Show page totals
    const blockedModals = await Content.call('getBlockedModals')

    renderTotals('#blocked-page', blockedModals)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)

    connected = false
  }

  // Show page specific content only if we have a content script connection
  $$('.if-connected').forEach((element) =>
    element.classList[connected ? 'remove' : 'add']('hidden')
  )

  if (connected) {
    // Add/remove hostnames to allow list
    const allowed = await Content.call('isAllowed')

    $('#input-allowed').checked = allowed

    $('#input-allowed').addEventListener('click', async (el) => {
      const { allowList } = await chrome.storage.sync.get({
        allowList: [],
      })

      const url = await Content.call('getUrl')

      let { hostname } = new URL(url)

      hostname = hostname.replace(/^www\./, '')

      if (el.target.checked) {
        allowList.push(hostname)
      } else {
        const index = allowList.findIndex((_hostname) => _hostname === hostname)

        if (index !== -1) {
          allowList.splice(index, 1)
        }
      }

      chrome.storage.sync.set({ allowList })

      Content.call('reload')
    })
  }

  // Definitions tab

  // Modal type select
  modalTypes.forEach((type) => {
    const option = el('option')

    option.value = type
    option.textContent = chrome.i18n.getMessage(`modalType${capitalize(type)}`)

    $('#input-modal-types').append(option)
  })

  $('#input-modal-types').addEventListener('change', (event) => {
    const modalType = event.target.value

    $('#errors-definitions').textContent = ''

    chrome.storage.sync
      .get({
        customDefinitions: {},
      })
      .then(
        ({ customDefinitions }) =>
          ($('#input-definitions').value = JSON.stringify(
            customDefinitions[modalType] || {},
            null,
            2
          ))
      )
  })

  $('#input-modal-types').dispatchEvent(new Event('change'))

  // Edit / debug toggle
  $$('input[name="input-mode"]').forEach((el) =>
    el.addEventListener('change', (event) => {
      const debug = event.target.value === 'debug'

      $('#input-definitions').classList[debug ? 'add' : 'remove']('hidden')
      $('#input-debug').classList[debug ? 'remove' : 'add']('hidden')
    })
  )

  // Reload page
  $('.reload').addEventListener('click', () => Content.call('reload'))

  // Format JSON on blur
  $('#input-definitions').addEventListener('blur', (event) => {
    const json = event.target.value || '{}'

    try {
      const definitions = JSON.parse(json)

      event.target.value = JSON.stringify(definitions, null, 2)

      const selectedType = $('#input-modal-types').value

      chrome.storage.sync
        .get({
          customDefinitions: modalTypes.reduce(
            (definitions, type) => ({ ...definitions, [type]: {} }),
            {}
          ),
        })
        .then(({ customDefinitions }) =>
          chrome.storage.sync.set({
            customDefinitions: {
              ...customDefinitions,
              [selectedType]: definitions,
            },
          })
        )
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
  })

  // Validate JSON on change
  $('#input-definitions').addEventListener(
    'input',
    debounce((event) => {
      const json = event.target.value || '{}'

      try {
        const definitionsByType = [
          {
            type: 'offers',
            definitions: JSON.parse(json),
          },
        ]

        const definitions = transformDefinitions(definitionsByType)

        $('#input-debug').textContent = JSON.stringify(definitions, null, 2)

        $('#errors-definitions').textContent = ''
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error)

        $('#errors-definitions').textContent = error.message || error.toString()
      }
    }, 500)
  )

  $('.content').classList.add('visible')
})()
