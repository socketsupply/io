'use strict'
const ipc = require('../ipc')
const { EventEmitter } = require('./events')

let isInitialized = false

class Bluetooth extends EventEmitter {
  constructor () {
    window.addEventListener('data', e => {
      if (e.detail.params.source === 'bluetooth') {
        this.emit('data', e.detail.data)
      }
    })
  }

  init (uuid = '') {
    if (isInitialized) {
      throw new Error('Bluetooth already initialized')
    }

    window.external.invoke(`ipc://bluetooth-subscribe?uuid=${uuid}`)
  }

  advertise (data, params = {}) {
    if (typeof data === 'string') {
      const enc = new TextEncoder().encode(data)
      data = enc.data
      params.length = enc.length
    }
    return ipc.send('bluetooth-advertise', params, data)
  }
}

exports.Bluetooth = Bluetooth
