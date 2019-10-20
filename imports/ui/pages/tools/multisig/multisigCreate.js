/* eslint no-console:0 */
/* global getXMSSDetails, anyAddressToRawAddress, hexToBytes */

import helpers from '@theqrl/explorer-helpers'
import qrlAddressValdidator from '@theqrl/validate-qrl-address'
import { checkWeightsAndThreshold } from '@theqrl/wallet-helpers'

Template.multisigCreate.onCreated(() => {
  // Route to open wallet is already opened
  if (Session.get('walletStatus').unlocked === false) {
    const params = {}
    const path = FlowRouter.path('/open', params)
    FlowRouter.go(path)
  }
})

Template.multisigCreate.helpers({
  isActiveTab(p) {
    if (Session.get('activeMultisigTab') === p) {
      return 'active'
    }
    return ''
  },
  creator() {
    if (LocalStore.get('addressFormat') === 'bech32') {
      return getXMSSDetails().addressB32
    }
    return getXMSSDetails().address
  },
  otsKeyEstimate() {
    const otsKeyEstimate = Session.get('otsKeyEstimate')
    return otsKeyEstimate
  },
  ledgerWalletDisabled() {
    if (getXMSSDetails().walletType === 'ledger') {
      return 'disabled'
    }
    return ''
  },
  isLedgerWallet() {
    if (getXMSSDetails().walletType === 'ledger') {
      return true
    }
    return false
  },
})
function generateTransaction() {
  // Get to/amount details
  const sendFrom = anyAddressToRawAddress(Session.get('transferFromAddress'))
  const txnFee = document.getElementById('fee').value
  const otsKey = document.getElementById('otsKey').value
  const pubKey = hexToBytes(getXMSSDetails().pk)
  const sendTo = document.getElementsByName('to[]')
  const sendAmounts = document.getElementsByName('amounts[]')
  const threshold = parseInt(document.getElementById('threshold').value, 10)

  // Capture outputs
  const thisAddressesTo = []
  const thisAmounts = []

  let validAddresses = 0
  _.each(sendTo, (item) => {
    console.log(item.value)
    const isValid = qrlAddressValdidator.hexString(item.value)
    if (isValid.result) {
      validAddresses += 1
    }
  })
  if (validAddresses === thisAddressesTo.length) {
    console.log('all addresses valid')
  } else {
    console.log('One or more of the signatories is invalid: please check the addresses carefully')
    return
  }

  for (let i = 0; i < sendTo.length; i += 1) {
    const thisAddress = sendTo[i].value
    thisAddressesTo.push(anyAddressToRawAddress(thisAddress.trim()))
  }

  // Format weights correctly.
  for (let i = 0; i < sendAmounts.length; i += 1) {
    const weightInt = parseInt(sendAmounts[i].value, 10)
    thisAmounts.push(weightInt)
  }

  console.log('sendFrom:', sendFrom)
  console.log('txnFee: ', txnFee)
  console.log('otsKey:', otsKey)
  console.log('pubKey:', pubKey)
  console.log('thisAddressesTo:', thisAddressesTo)
  console.log('thisAmounts: ', thisAmounts)
  console.log('threshold', threshold)

  const cwt = checkWeightsAndThreshold(thisAmounts, threshold)
  console.log('cwt:', cwt)

  if (!cwt.result) {
    $('#checkWeightsModal .message .header').text('There\'s a problem')
    if (cwt.error === 'Array has non-integer values') {
      $('#checkWeightsModal p').text('One or more of the weights entered is invalid.')
    } else {
      $('#checkWeightsModal p').text(cwt.error)
    }
    $('#checkWeightsModal').modal('show')
  }
}
function getRecipientIds() {
  const ids = []
  const elements = document.getElementsByName('to[]')
  _.each(elements, (element) => {
    const thisId = element.id
    const parts = thisId.split('_')
    ids.push(parseInt(parts[1], 10))
  })
  return ids
}
// Function to initialise form validation
function initialiseFormValidation() {
  const validationRules = {}

  // Calculate validation fields based on to/amount fields
  _.each(getRecipientIds(), (id) => {
    validationRules['to' + id] = {
      identifier: 'to_' + id,
      rules: [
        {
          type: 'empty',
          prompt: 'Please enter the QRL address you wish to send to',
        },
        {
          type: 'qrlAddressValid',
          prompt: 'Please enter a valid QRL address',
        },
      ],
    }

    validationRules['amounts' + id] = {
      identifier: 'amounts_' + id,
      rules: [
        {
          type: 'empty',
          prompt: 'You must enter a weight',
        },
        {
          type: 'number',
          prompt: 'Weight must be a number',
        },
        {
          type: 'maxDecimals',
          prompt: 'You can only enter up to 9 decimal places in the amount field',
        },
      ],
    }
  })

  // Now set fee and otskey validation rules
  validationRules['fee'] = {
    id: 'fee',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter a fee',
      },
      {
        type: 'number',
        prompt: 'Fee must be a number',
      },
      {
        type: 'maxDecimals',
        prompt: 'You can only enter up to 9 decimal places in the fee field',
      },
    ],
  }
  validationRules['otsKey'] = {
    id: 'otsKey',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter an OTS Key Index',
      },
      {
        type: 'number',
        prompt: 'OTS Key Index must be a number',
      },
    ],
  }

  // Address Validation
  $.fn.form.settings.rules.qrlAddressValid = function (value) {
    try {
      const rawAddress = anyAddressToRawAddress(value)
      const thisAddress = helpers.rawAddressToHexAddress(rawAddress)
      const isValid = qrlAddressValdidator.hexString(thisAddress)
      return isValid.result
    } catch (e) {
      return false
    }
  }

  // Initialise the form validation
  $('.ui.form').form({
    fields: validationRules,
  })
}
Template.multisigCreate.events({
  'click #addTransferRecipient': (event) => {
    event.preventDefault()
    event.stopPropagation()

    const nextRecipientId = Math.max(...getRecipientIds()) + 1

    const newTransferRecipient = `
      <div>
        <div class="field">
          <label>Additional Signatory</label>
          <div class="ui action center aligned input"  id="amountFields" style="width: 100%; margin-bottom: 10px;">
            <input type="text" id="to_${nextRecipientId}" name="to[]" placeholder="Address" style="width: 55%;">
            <input type="text" id="amounts_${nextRecipientId}" name="amounts[]" placeholder="Weight" style="width: 30%;">
            <button class="ui red small button removeTransferRecipient" style="width: 10%"><i class="remove user icon"></i></button>
          </div>
        </div>
      </div>
    `

    // Append newTransferRecipient to transferRecipients div
    $('#transferRecipients').append(newTransferRecipient)

    // Initialise form validation
    // initialiseFormValidation()
  },
  'click .removeTransferRecipient': (event) => {
    event.preventDefault()
    event.stopPropagation()

    // Remove the recipient
    $(event.currentTarget).parent().parent().parent()
      .remove()

    // Initialise form validation
    initialiseFormValidation()
  },
  'click #generateTransaction': (event) => {
    event.preventDefault()
    event.stopPropagation()
    generateTransaction()
  },
})

Template.multisigCreate.onRendered(() => {
  Session.set('activeMultisigTab', 'create')
})
