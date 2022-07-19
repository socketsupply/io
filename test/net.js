import mock from './mock'

import { test } from 'tape'
import net from '../net'

// createServer, call listen, close server
test('net.createServer', t => {
  const server = net.createServer(() => {
    // no actual connections on this test
  })
  const ID = server._serverId
  // should not have sent a message yet
  mock.create(t, 'tcpCreateServer',
    { port: 9000, address: '127.0.0.1' },
    { data: { serverId: ID, port: 9000, address: '127.0.0.1', family: 'IPv4' } }
  )

  // unref does nothing, but returns self
  t.equal(server.unref(), server)

  // the default behaviour seems to be to listen on IPv6,
  // guessing that probably depends on the system though.
  server.listen(9000, '127.0.0.1', function () {
    t.deepEqual(
      server.address(),
      { port: 9000, address: '127.0.0.1', family: 'IPv4' }
    )

    mock.create(t, 'tcpClose', { serverId: ID }, {})

    server.close(function () {
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      t.end()
    })
  })
})

// net.connect returns socket, write data, receive data, end stream

test('net.connect', t => {
  const ID = net.rand64()
  const HELLO = 'Hello, World!\n'

  mock.create(t, 'tcpConnect',
    { port: 9000, address: '127.0.0.1' },
    {
      data: {
        clientId: ID
      }
    }
  )

  const _stream = net.connect(9000, '127.0.0.1', function (err, stream) {
    t.equal(_stream, stream)
    t.equal(err, null)
    t.equal(stream.allowHalfOpen, false)

    const ID = _stream.clientId

    mock.create(t, 'tcpSend',
      { clientId: ID, data: HELLO },
      {}
    )

    mock.methods.tcpReadStart = [q => {
      t.deepEqual(q, { clientId: ID })
      return (async () => {
        return {}
      })()
    }]

    // using setTimeout here is a sign we don't understand something.
    //
    setTimeout(() => {
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      mock.create(t, 'tcpShutdown',
        { clientId: ID },
        {}
      )
      mock.create(t, 'tcpClose',
        { clientId: ID },
        {}
      )
      stream.__write('')

      stream.end()
      stream.on('close', () => {
        t.deepEqual(mock.methods, {}, 'no uncalled methods')
        t.end()
      })
    }, 100)
    stream.write(HELLO)
  })

  t.ok(_stream)
})

test('net.connect, allowHalfOpen=false', (t) => {
  const ID = net.rand64()
  let ended = false
  mock.create(t, 'tcpConnect',
    { port: 9000, address: '127.0.0.1' },
    {
      data: {
        clientId: ID
      }
    }
  )

  const _stream = net.connect(9000, '127.0.0.1', function (err, stream) {
    t.equal(_stream, stream)
    t.equal(err, null)
    t.equal(stream.allowHalfOpen, false)

    const ID = _stream.clientId

    stream.on('end', function () {
      ended = true
    })
    mock.create(t, 'tcpShutdown',
      { clientId: ID },
      {}
    )
    mock.create(t, 'tcpClose',
      { clientId: ID },
      {}
    )
    stream.end()
    stream.__write('')

    stream.on('close', () => {
      t.ok(ended)
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      t.end()
    })
  })
  t.ok(_stream)
})

test('net.connect allowHalfOpen=true', (t) => {
  const ID = net.rand64()
  let ended = false

  mock.create(t, 'tcpConnect',
    { port: 9000, address: '127.0.0.1' },
    {
      data: {
        clientId: ID
      }
    }
  )
  const _stream = net.connect({
    port: 9000,
    host: '127.0.0.1',
    allowHalfOpen: true
  }, function (err, stream) {
    t.equal(_stream, stream)
    t.equal(err, null)
    t.equal(stream.allowHalfOpen, true)

    const ID = _stream.clientId

    stream.on('end', function () {
      ended = true
      stream.end()
    })

    mock.create(t, 'tcpShutdown',
      { clientId: ID },
      {}
    )

    mock.create(t, 'tcpClose',
      { clientId: ID },
      {}
    )

    stream.__write('')

    stream.on('close', () => {
      t.ok(ended)
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      t.end()
    })
  })
  t.ok(_stream)
})

test('net.connect allowHalfOpen=true, write write write', (t) => {
  const ID = net.rand64()
  const HELLO = 'Hello, World!\n'
  let ended = false
  mock.create(t, 'tcpConnect',
    { port: 9000, address: '127.0.0.1' },
    {
      data: {
        clientId: ID
      }
    }
  )
  const _stream = net.connect({
    port: 9000,
    host: '127.0.0.1',
    allowHalfOpen: true
  }, function (err, stream) {
    t.equal(_stream, stream)
    t.equal(err, null)
    t.equal(stream.allowHalfOpen, true)
    // to just test writes, end the read side immediately
    // (by simulated end receive '')
    stream.__write('')

    stream.on('end', function () {
      ended = true
    })

    const waiting = []

    const ID = _stream.clientId

    function next (data) {
      const p = new Promise((resolve) => {
        waiting.push(resolve)
      })
      return (args) => {
        t.equal(args.clientId, ID)
        t.equal(data, args.data)
        return p
      }
    }

    mock.methods.tcpSend = [
      next(HELLO + 1),
      next(HELLO + 2),
      next(HELLO + 3),
      next(HELLO + 4),
      next(HELLO + 5),
      next(HELLO + 6),
      next(HELLO + 7)
    ]

    stream.write(HELLO + 1)
    stream.write(HELLO + 2)
    stream.write(HELLO + 3)
    stream.write(HELLO + 4)
    stream.write(HELLO + 5)
    stream.write(HELLO + 6)
    stream.write(HELLO + 7)

    stream.end()

    const int = setInterval(() => {
      waiting.shift()({})
      if (!waiting.length) {
        clearInterval(int)
      }
    }, 100)

    mock.create(t, 'tcpShutdown',
      { clientId: ID },
      {}
    )

    mock.create(t, 'tcpClose',
      { clientId: ID },
      {}
    )

    stream.on('close', () => {
      t.ok(ended)
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      t.end()
    })
  })
  t.ok(_stream)
})

test.skip('net.connect', (t) => {
  const ID = net.rand64()
  mock.create(t, 'tcpConnect',
    { port: 9000, address: '127.0.0.1' },
    {
      data: {
        clientId: ID
      }
    }
  )

  const _stream = net.connect(9000, '127.0.0.1', function (err, stream) {
    t.equal(_stream, stream)
    t.equal(err, null)
    t.equal(stream.allowHalfOpen, false)

    const ID = _stream.clientId

    mock.methods.tcpReadStart = [(q) => {
      t.deepEqual(q, { clientId: ID })
      return (async () => {
        return {}
      })()
    }]

    // using setTimeout here is a sign we don't understand something.
    //
    setTimeout(() => {
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      mock.create(t, 'tcpShutdown',
        { clientId: ID },
        {}
      )

      mock.create(t, 'tcpClose',
        { clientId: ID },
        {}
      )

      stream.__write('')

      stream.end()
      stream.on('close', () => {
        t.deepEqual(mock.methods, {}, 'no uncalled methods')
        t.end()
      })
    }, 100)
    //    stream.write(HELLO)
  })
  t.ok(_stream)
})

test('net.connect allowHalfOpen=true readStart readStop', (t) => {
  const ID = net.rand64()
  const HELLO = 'Hello, World!\n'

  mock.create(t, 'tcpConnect',
    { port: 9000, address: '127.0.0.1' },
    {
      data: {
        clientId: ID
      }
    }
  )

  const _stream = net.connect({
    port: 9000,
    host: '127.0.0.1',
    allowHalfOpen: true
  }, function (err, stream) {
    t.equal(_stream, stream)
    t.equal(err, null)
    t.equal(stream.allowHalfOpen, true)

    const ID = _stream.clientId

    //    stream.end()
    mock.methods.tcpReadStart = [(q) => {
      t.deepEqual(q, { clientId: ID })
      return (async () => {
        return { data: HELLO }
      })()
    }]

    // trigger flow?
    const fn = () => {}
    stream.on('data', fn)

    mock.methods.tcpReadStop = [(q) => {
      t.deepEqual(q, { clientId: ID })
      return (async () => {
        return {}
      })()
    }]

    setTimeout(() => {
      stream.pause()
      t.deepEqual(mock.methods, {}, 'no uncalled methods')
      t.end()
    }, 1000)
  })
})
