'use strict'

import { Buffer } from 'buffer'

import { EventEmitter } from './events.js'
import { isIPv4 } from './net.js'
import dns from './dns.js'
import { rand64 } from './util.js'

const isArrayBufferView = buf => {
  return !Buffer.isBuffer(buf) && ArrayBuffer.isView(buf)
}

const fixBufferList = list => {
  const newlist = new Array(list.length)

  for (let i = 0, l = list.length; i < l; i++) {
    const buf = list[i]

    if (typeof buf === 'string') {
      newlist[i] = Buffer.from(buf)
    } else if (!isArrayBufferView(buf)) {
      return null
    } else {
      newlist[i] = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
    }
  }

  return newlist
}

class Socket extends EventEmitter {
  constructor (options) {
    super()

    this.serverId = rand64()
    this.clientId = rand64()

    this.state = {
      recvBufferSize: options.recvBufferSize,
      sendBufferSize: options.sendBufferSize,
      connectState: 2,
      reuseAddr: options.reuseAddr,
      ipv6Only: options.ipv6Only
    }

    this.connect()
  }

  async _getSockData () {
    const { err, data } = await window._ipc.send('udpGetSockName', {
      id: this.clientId
    })

    if (err) return { err }
    return { data }
  }

  async _getPeerData () {
    const { err, data } = await window._ipc.send('udpGetPeerName', {
      id: this.clientId
    })

    if (err) return { err }
    return { data }
  }

  //
  // Listen for datagram messages on a named port and optional address
  // If address is not specified, the operating system will attempt to
  // listen on all addresses. Once binding is complete, a 'listening'
  // event is emitted and the optional callback function is called.
  //
  // If binding fails, an 'error' event is emitted.
  //
  async bind (arg1, arg2, cb) {
    let options = {}

    if (typeof arg2 === 'function') {
      cb = arg2
      options.address = undefined
    }

    if (typeof arg1 === 'number') {
      options.port = arg1
      options.address = arg2
    } else if (typeof arg1 === 'object') {
      options = { ...arg1 }
    } else {
      throw new Error('invalid arguments')
    }

    if (this.clientId) {
      const err = new Error('already bound')
      if (cb) return cb(err)
      return { err }
    }

    function removeListeners () {
      this.removeListener('close', removeListeners)
      this.removeListener('error', removeListeners)
    }

    function onListening () {
      Function.prototype.call(removeListeners, this)
      if (cb) Function.prototype.call(cb, this)
    }

    this.on('error', removeListeners)
    this.on('listening', onListening)

    if (!options.address) {
      if (this.type === 'udp4') {
        options.address = '0.0.0.0'
      } else {
        options.address = '::'
      }
    } else if (!isIPv4(options.address)) {
      const {
        err: errLookup,
        data: dataLookup
      } = await dns.lookup(options.address)

      if (errLookup) {
        this.emit('error', errLookup)
        return { err: errLookup }
      }

      options.address = dataLookup.ip
    }

    const { err: errBind, data } = await window._ipc.send('udpBind', {
      serverId: this.serverId,
      address: options.address,
      port: options.port || 0,
      reuseAddr: options.reuseAddr, // UV_UDP_REUSEADDR
      ipv6Only: options.ipv6Only // UV_UDP_IPV6ONLY
    })

    if (errBind) {
      this.emit('error', errBind)
      return { err: errBind }
    }

    const { data: sockData } = await this._getSockData({
      connectionId: this.serverId
    })

    this._address = sockData.address
    this._port = sockData.port
    this._family = sockData.family

    const listener = e => {
      if (e.detail.params.serverId === this.serverId) {
        this.emit('message', e.detail.data)
        if (e.detal.params.EOF) window.removeListener('data', listener)
      }
    }

    window.addEventListener('data', listener)

    const {
      err: errReadStart
    } = await window._ipc.send('updReadStart', { serverId: this.serverId })

    if (errReadStart) {
      if (cb) return cb(errReadStart)
      return { err: errReadStart }
    }

    if (cb) cb(null)
    return { data }
  }

  //
  // Associates the Socket to a remote address and port. Every message sent
  // by this handle is automatically sent to that destination. Also, the
  // socket will only receive messages from that remote peer. Trying to call
  // connect() on an already connected socket will result in an error.
  //
  // If address is not provided, '127.0.0.1' (for udp4 sockets) or '::1' (for
  // udp6 sockets) will be used by default. Once the connection is complete, a
  // 'connect' event is emitted and the optional callback function is called.
  // In case of failure, the callback is called or, failing this, an 'error'
  // event is emitted.
  //
  async connect (arg1, arg2, cb) {
    if (this.clientId) {
      const err = new Error('already connected')
      if (cb) return cb(err)
      return { err }
    }

    const port = arg1
    let address = arg2

    if (typeof arg2 === 'function') {
      cb = arg2
      address = undefined
    }

    const {
      err: errBind
    } = await this.bind({ port: 0 }, null)

    if (errBind) {
      if (cb) return cb(errBind)
      return { err: errBind }
    }

    this.once('connect', cb)

    const {
      err: errLookup,
      data: dataLookup
    } = await dns.lookup(address)

    if (errLookup) {
      this.emit('error', errLookup)
      return { err: errLookup }
    }

    const {
      err: errConnect,
      dataConnect
    } = await window._ipc.send('udpConnect', {
      ip: dataLookup.ip,
      port: port || 0
    })

    if (errConnect) {
      this.emit('error', errConnect)
      return { err: errConnect }
    }

    this.state.connectState = 2

    this.emit('connect')

    // TODO udpConnect could return the peer data instead of putting it
    // into a different call and we could shave off a bit of time here.
    const {
      err: errGetPeerData,
      data: dataPeerData
    } = await this._getPeerData({ clientId: dataConnect.clientId })

    if (errGetPeerData) {
      this.emit('error', errGetPeerData)
      return { err: errGetPeerData }
    }

    this._remoteAddress = dataPeerData.address
    this._remotePort = dataPeerData.port
    this._remoteFamily = dataPeerData.family

    if (cb) cb(null)
    return {}
  }

  async disconnect () {
    const { err: errConnect } = await window._ipc.send('udpDisconnect', {
      ip: this._remoteAddress,
      port: this._remotePort || 0
    })

    if (errConnect) {
      this.emit('error', errConnect)
      return { err: errConnect }
    }

    if (this.connectedState === 2) {
      this.emit('close')
    }

    return {}
  }

  //
  // Broadcasts a datagram on the socket. For connectionless sockets, the
  // destination port and address must be specified. Connected sockets, on the
  // other hand, will use their associated remote endpoint, so the port and
  // address arguments must not be set.
  //
  // The msg argument contains the message to be sent. Depending on its type,
  // different behavior can apply. If msg is a Buffer, any TypedArray or a
  // DataView, the offset and length specify the offset within the Buffer where
  // the message begins and the number of bytes in the message, respectively.
  // If msg is a String, then it is automatically converted to a Buffer with
  // 'utf8' encoding. With messages that contain multi-byte characters, offset
  // and length will be calculated with respect to byte length and not the
  // character position. If msg is an array, offset and length must not be
  // specified.
  //
  // The address argument is a string. If the value of address is a host name,
  // DNS will be used to resolve the address of the host. If address is not
  // provided or otherwise nullish, '127.0.0.1' (for udp4 sockets) or '::1'
  // (for udp6 sockets) will be used by default.
  //
  // If the socket has not been previously bound with a call to bind, the socket
  // is assigned a random port number and is bound to the "all interfaces"
  // address ('0.0.0.0' for udp4 sockets, '::0' for udp6 sockets.)
  //
  // An optional callback function may be specified to as a way of reporting DNS
  // errors or for determining when it is safe to reuse the buf object. DNS
  // lookups delay the time to send for at least one tick of the Node.js event
  // loop.
  //
  // The only way to know for sure that the datagram has been sent is by using a
  // callback. If an error occurs and a callback is given, the error will be
  // passed as the first argument to the callback. If a callback is not given,
  // the error is emitted as an 'error' event on the socket object.
  //
  // Offset and length are optional but both must be set if either are used.
  // They are supported only when the first argument is a Buffer, a TypedArray,
  // or a DataView.
  //
  async send (buffer, ...args) {
    let offset, length, port, address, cb
    const connected = this.state.connectState === 2

    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer)
    }

    const index = args.findIndex(arg => typeof arg === 'function')
    if (index > -1) cb = args[index]

    if (typeof args[2] === 'number') {
      [offset, length, port, address] = args.slice(0, index)

      if (connected && (port || address)) {
        throw new Error('Already connected')
      }

      buffer = Buffer.from(buffer.buffer, buffer.byteOffset + offset, length)
    } else {
      [port, address] = args.slice(0, index)
    }

    let list

    if (!Array.isArray(buffer)) {
      if (typeof buffer === 'string') {
        list = [Buffer.from(buffer)]
      } else if (!isArrayBufferView(buffer)) {
        // throw new Error('Invalid buffer')
        list = Buffer.from(buffer)
      } else {
        list = [buffer]
      }
    } else if (!(list = fixBufferList(buffer))) {
      throw new Error('Invalid buffer')
    }

    const { err: errBind } = await this.bind({ port: 0 }, null)

    if (errBind) {
      if (cb) return cb(errBind)
      return { err: errBind }
    }

    if (list.length === 0) {
      list.push(Buffer.alloc(0))
    }

    if (!connected) {
      const {
        err: errLookup,
        data: dataLookup
      } = await dns.lookup(address)

      if (errLookup) {
        if (cb) return cb(errLookup)
        return { err: errLookup }
      }

      address = dataLookup.ip
    }

    const { err: errSend } = await window._ipc.send('udpSend', {
      state: this.state,
      address,
      port,
      list
    })

    if (errSend) {
      if (cb) return cb(errSend)
      return { err: errSend }
    }

    if (cb) cb(null)
    return {}
  }

  async close (cb) {
    if (typeof cb === 'function') {
      this.on('close', cb)
    }

    const { err } = await window._ipc.send('udpClose', {
      id: this.clientId
    })

    if (err && cb) return cb(err)
    if (err) return { err }

    this.emit('close')
    return {}
  }

  //
  // we want to make an ipc call to uv_udp_getsockname, but unlike node
  // we can't magically block the main thread, so we must do it when the
  // socket is bound or when it is connected. Also see remoteAddress().
  //
  address () {
    return {
      remoteAddress: this._address,
      remotePort: this._port,
      remoteFamily: this._family
    }
  }

  remoteAddress () {
    return {
      remoteAddress: this._remoteAddress,
      remotePort: this._remotePort,
      remoteFamily: this._remoteFamily
    }
  }

  //
  // Sets the SO_RCVBUF socket option. Sets the maximum socket receive buffer in
  // bytes.
  //
  setRecvBufferSize (size) {
    this.state.recvBufferSize = size
  }

  //
  // Sets the SO_SNDBUF socket option. Sets the maximum socket send buffer in
  // bytes.
  //
  setSendBufferSize (size) {
    this.state.sendBufferSize = size
  }

  getRecvBufferSize () {
    return this.state.recvBufferSize
  }

  getSendBufferSize () {
    return this.state.sendBufferSize
  }

  //
  // For now wer aren't going to implement any of the multicast options,
  // mainly because 1. we don't need it in hyper and 2. if a user wants
  // to deploy their app to the app store, they will need to request the
  // multicast entitlement from apple. If someone really wants this they
  // can implement it.
  //
  setBroadcast () {
    throw new Error('not implemented')
  }

  setTTL () {
    throw new Error('not implemented')
  }

  setMulticastTTL () {
    throw new Error('not implemented')
  }

  setMulticastLoopback () {
    throw new Error('not implemented')
  }

  setMulticastMembership () {
    throw new Error('not implemented')
  }

  setMulticastInterface () {
    throw new Error('not implemented')
  }

  addMembership () {
    throw new Error('not implemented')
  }

  dropMembership () {
    throw new Error('not implemented')
  }

  addSourceSpecificMembership () {
    throw new Error('not implemented')
  }

  dropSourceSpecificMembership () {
    throw new Error('not implemented')
  }

  ref () {
    return this
  }

  unref () {
    return this
  }
}

const createSocket = (type, listener) => {
  return new Socket(type, listener)
}

export {
  Socket,
  createSocket
}
