import { ReadStream, WriteStream } from './stream.js'
import { isBufferLike, isFunction } from '../util.js'
import { Dir, Dirent } from './dir.js'
import * as constants from './constants.js'
import * as promises from './promises.js'
import { FileHandle } from './handle.js'
import { Stats } from './stats.js'
import * as ipc from '../ipc.js'

export * from './stream.js'

function defaultCallback (err) {
  if (err) throw err
}

async function visit (path, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  const { flags, mode } = options || {}

  let handle = null
  try {
    handle = await FileHandle.open(path, flags, mode, options)
  } catch (err) {
    return callback(err)
  }

  if (handle) {
    await callback(null, handle)

    try {
      await handle.close(options)
    } catch (err) {
      console.warn(err.message || err)
    }
  }
}

/**
 * Asynchronously check access a file for a given mode calling `callback`
 * upon success or error.
 * @see {https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#fsopenpath-flags-mode-callback}
 * @param {string | Buffer | URL} path
 * @param {?(string)} [mode = F_OK(0)]
 * @param {function(err, fd)} callback
 */
export function access (path, mode, callback) {
  if (typeof mode === 'function') {
    callback = mode
    mode = FileHandle.DEFAULT_ACCESS_MODE
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  try {
    FileHandle.access(path, mode)
      .then((mode) => callback(null, mode))
      .catch((err) => callback(err))
  } catch (err) {
    callback(err)
  }
}

/**
 * @TODO
 */
export function appendFile (path, data, options, callback) {
}

/**
 * @TODO
 */
export function chmod (path, mode, callback) {
  if (typeof mode !== 'number') {
    throw new TypeError('mode must be a number.')
  }

  if (mode < 0 || !Number.isFinite(mode)) {
    throw new RangeError('mode must be a positive finite number.')
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  ipc.request('fsChmod', { mode, path }).then((result) => {
    result?.err ? callback(result.err) : callback(null)
  })
}

/**
 * @TODO
 */
export function chown (path, uid, gid, callback) {
}

/**
 * Asynchronously close a file descriptor calling `callback` upon success or error.
 * @see {https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#fsclosefd-callback}
 * @param {number} fd
 * @param {function(err)} callback
 */
export function close (fd, callback) {
  if (typeof callback !== 'function') {
    callback = defaultCallback
  }

  try {
    FileHandle.from(fd).close()
      .then(() => callback(null))
      .catch((err) => callback(err))
  } catch (err) {
    callback(err)
  }
}

/**
 * @TODO
 */
export function copyFile (src, dest, mode, callback) {
}

/**
 * @TODO
 */
export function createReadStream (path, options) {
  if (path?.fd) {
    options = path
    path = options?.path || null
  }

  let handle = null
  const stream = new ReadStream({
    autoClose: typeof options?.fd !== 'number',
    ...options
  })

  if (options?.fd) {
    handle = FileHandle.from(options.fd)
  } else {
    handle = new FileHandle({ flags: 'r', path, ...options })
    handle.open(options).catch((err) => stream.emit('error', err))
  }

  stream.once('end', async () => {
    if (options?.autoClose !== false) {
      try {
        await handle.close(options)
      } catch (err) {
        stream.emit('error', err)
      }
    }
  })

  stream.setHandle(handle)

  return stream
}

/**
 * @TODO
 */
export function createWriteStream (path, options) {
  if (path?.fd) {
    options = path
    path = options?.path || null
  }

  let handle = null
  const stream = new WriteStream({
    autoClose: typeof options?.fd !== 'number',
    ...options
  })

  if (typeof options?.fd === 'number') {
    handle = FileHandle.from(options.fd)
  } else {
    handle = new FileHandle({ flags: 'w', path, ...options })
    handle.open(options).catch((err) => stream.emit('error', err))
  }

  stream.once('finish', async () => {
    if (options?.autoClose !== false) {
      try {
        await handle.close(options)
      } catch (err) {
        stream.emit('error', err)
      }
    }
  })

  stream.setHandle(handle)

  return stream
}

/**
 * @TODO
 */
export function fstat (fd, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  try {
    FileHandle.from(fd).stat(options)
      .then(() => callback(null))
      .catch((err) => callback(err))
  } catch (err) {
    callback(err)
  }
}

/**
 * @TODO
 */
export function lchmod (path, mode, callback) {
}

/**
 * @TODO
 */
export function lchown (path, uid, gid, callback) {
}

/**
 * @TODO
 */
export function lutimes (path, atime, mtime, callback) {
}

/**
 * @TODO
 */
export function link (existingPath, newPath, callback) {
}

/**
 * @TODO
 */
export function lstat (path, options, callback) {
}

/**
 * @TODO
 */
export function mkdir (path, options, callback) {
}

/**
 * Asynchronously open a file calling `callback` upon success or error.
 * @see {https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#fsopenpath-flags-mode-callback}
 * @param {string | Buffer | URL} path
 * @param {?(string)} [flags = 'r']
 * @param {?(string)} [mode = 0o666]
 * @param {function(err, fd)} callback
 */
export function open (path, flags, mode, options, callback) {
  if (typeof flags === 'object') {
    callback = mode
    options = flags
    flags = FileHandle.DEFAULT_OPEN_FLAGS
    mode = FileHandle.DEFAULT_OPEN_MODE
  }

  if (typeof mode === 'object') {
    callback = options
    options = mode
    flags = FileHandle.DEFAULT_OPEN_FLAGS
    mode = FileHandle.DEFAULT_OPEN_MODE
  }

  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (typeof flags === 'function') {
    callback = flags
    flags = FileHandle.DEFAULT_OPEN_FLAGS
    mode = FileHandle.DEFAULT_OPEN_MODE
  }

  if (typeof mode === 'function') {
    callback = mode
    mode = FileHandle.DEFAULT_OPEN_MODE
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  try {
    FileHandle.open(path, flags, mode, options)
      .then((handle) => callback(null, handle.fd))
      .catch((err) => callback(err))
  } catch (err) {
    callback(err)
  }
}
/**
 * @TODO
 */
export function opendir (path, options, callback) {
}

/**
 * Asynchronously read from an open file descriptor.
 * @see {https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#fsreadfd-buffer-offset-length-position-callback}
 * @param {number} fd
 * @param {object | Buffer | TypedArray} buffer
 */
export function read (fd, buffer, offset, length, position, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (typeof buffer === 'object' && !isBufferLike(buffer)) {
    options = buffer
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  try {
    FileHandle.from(fd).read({ ...options, buffer, offset, length, position })
      .then(({ bytesRead, buffer }) => callback(null, bytesRead, buffer))
      .catch((err) => callback(err))
  } catch (err) {
    callback(err)
  }
}

/**
 * @TODO
 */
export function readdir (path, options, callback) {
}

/**
 * @param {string | Buffer | URL | number } path
 * @param {object} [options]
 * @param {function(err, buffer)} callback
 */
export function readFile (path, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (typeof options === 'string') {
    options = { encoding: options }
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  visit(path, options, async (err, handle) => {
    let buffer = null

    if (err) {
      callback(err)
      return
    }

    try {
      buffer = await handle.readFile(options)
    } catch (err) {
      callback(err)
      return
    }

    callback(null, buffer)
  })
}

/**
 * @TODO
 */
export function readlink (path, options, callback) {
}

/**
 * @TODO
 */
export function realpath (path, options, callback) {
}

/**
 * @TODO
 */
export function rename (oldPath, newPath, callback) {
}

/**
 * @TODO
 */
export function rmdir (path, options, callback) {
}

/**
 * @TODO
 */
export function rm (path, options, callback) {
}

/**
 * @TODO
 */
export function stat (path, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  visit(path, async (err, handle) => {
    let stats = null

    if (err) {
      callback(err)
      return
    }

    try {
      stats = await handle.stat(options)
    } catch (err) {
      callback(err)
      return
    }

    callback(null, stats)
  })
}

/**
 * @TODO
 */
export function symlink (target, path, type, callback) {
}

/**
 * @TODO
 */
export function truncate (path, length, callback) {
}

/**
 * @TODO
 */
export function unlink (path, callback) {
}

/**
 * @TODO
 */
export function utimes (path, atime, mtime, callback) {
}

/**
 * @TODO
 */
export function watch (path, options, callback) {
}

/**
 * @TODO
 */
export function write (fd, buffer, offset, length, position, callback) {
}

/**
 * @TODO
 */
export function writeFile (path, data, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (typeof options === 'string') {
    options = { encoding: options }
  }

  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.')
  }

  visit(path, { flag: 'w', ...options }, async (err, handle) => {
    if (err) {
      callback(err)
      return
    }

    try {
      await handle.writeFile(data, options)
    } catch (err) {
      callback(err)
      return
    }

    callback(null)
  })
}

/**
 * @TODO
 */
export function writev (fd, buffers, position, callback) {
}

// re-exports
export {
  constants,
  Dir,
  Dirent,
  FileHandle,
  promises,
  ReadStream,
  Stats,
  WriteStream
}

import * as exports from './index.js'

for (const key in exports) {
  const value = exports[key]
  if (key in promises && isFunction(value) && isFunction(promises[key])) {
    value[Symbol.for('nodejs.util.promisify.custom')] = promises[key]
  }
}
