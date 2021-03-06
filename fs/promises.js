import { FileHandle } from './handle.js'

async function visit (path, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  const { flags, mode } = options || {}

  // just visit `FileHandle`, without closing if given
  if (path instanceof FileHandle) {
    return await callback(handle)
  } else if (path?.fd) {
    const value = await callback(FileHandle.from(path.fd))
  }

  const handle = await FileHandle.open(path, flags, mode, options)
  const value = await callback(handle)
  await handle.close(options)

  return value
}

/**
 * Asynchronously check access a file.
 * @see {https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#fspromisesaccesspath-mode}
 * @param {string | Buffer | URL} path
 * @param {?(string)} [mode = F_OK(0)]
 * @param {?(object)} [options]
 */
export async function access (path, mode, options) {
  return await FileHandle.access(path, mode, options)
}

/**
 * @TODO
 */
export async function appendFile (path, data, options) {
}

/**
 * @TODO
 */
export async function chmod (path, mode) {
}

/**
 * @TODO
 */
export async function chown (path, uid, gid) {
}

/**
 * @TODO
 */
export async function copyFile (src, dest, mode) {
}

/**
 * @TODO
 */
export async function lchmod (path, mode) {
}

/**
 * @TODO
 */
export async function lchown (path, uid, gid) {
}

/**
 * @TODO
 */
export async function lutimes (path, atime, mtime) {
}

/**
 * @TODO
 */
export async function link (existingPath, newPath) {
}

/**
 * @TODO
 */
export async function lstat (path, options) {
}

/**
 * @TODO
 */
export async function mkdir (path, options) {
}

/**
 * Asynchronously open a file.
 * https://nodejs.org/api/fs.html#fspromisesopenpath-flags-mode
 *
 * @param {string | Buffer | URL} path
 * @param {string} flags - default: 'r'
 * @param {string} mode - default: 0o666
 * @return {Promise<FileHandle>}
 */
export async function open (path, flags, mode) {
  return await FileHandle.open(path, flags, mode)
}

/**
 * @TODO
 */
export async function opendir (path, options) {
}

/**
 * @TODO
 */
export async function readdir (path, options) {
}

/**
 * @TODO
 * @param {string} path
 * @param {?(object)} [options]
 */
export async function readFile (path, options) {
  return await visit(path, options, async (handle) => {
    return await handle.readFile(options)
  })
}

/**
 * @TODO
 */
export async function readlink (path, options) {
}

/**
 * @TODO
 */
export async function realpath (path, options) {
}

/**
 * @TODO
 */
export async function rename (oldPath, newPath) {
}

/**
 * @TODO
 */
export async function rmdir (path, options) {
}

/**
 * @TODO
 */
export async function rm (path, options) {
}

/**
 * @TODO
 */
export async function stat (path, options) {
}

/**
 * @TODO
 */
export async function symlink (target, path, type) {
}

/**
 * @TODO
 */
export async function truncate (path, length) {
}

/**
 * @TODO
 */
export async function unlink (path) {
}

/**
 * @TODO
 */
export async function utimes (path, atime, mtime) {
}

/**
 * @TODO
 */
export async function watch (path, options) {
}

/**
 * @TODO
 * @param {string} path
 * @param {string|Buffer|Array|TypedArray} data
 * @param {?(object)} [options]
 */
export async function writeFile (path, data, options) {
  return await visit(path, { flag: 'w', ...options }, async (handle) => {
    return await handle.writeFile(data, options)
  })
}
