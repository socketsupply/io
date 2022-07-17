'use strict'

const { promisify } = require('util')
const mock = require('./mock')

const fs = require('../../node/fs')
const { test } = require('tape')

test('FileHandle', async t => {
  mock.create(t, 'fsOpen',
    {},
    {}
  )

  const handle = await fs.promises.open('./foo.txt')
  t.ok(handle.id.toString().length, 'handle provides an id')
})

test('nodejs.util.promisify.custom', (t) => {
  for (const key in fs) {
    const value = fs[key]
    if (typeof fs.promises[key] === 'function') {
      t.equal(promisify(value), fs.promises[key], `promisify(fs.${key})`)
    }
  }

  t.end()
})