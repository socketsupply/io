'use strict'

const buffer = require('./buffer')
const dgram = require('./dgram')
const dns = require('./dns')
const events = require('./events')
const fs = require('./fs')
const net = require('./net')
const os = require('./os')
const stream = require('./stream')

module.exports = {
  buffer,
  Buffer: buffer.Buffer,
  dgram,
  dns,
  events,
  fs,
  net,
  os,
  stream
}
