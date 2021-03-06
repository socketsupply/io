import { toProperCase } from './util.js'
import * as ipc from './ipc.js'

const UNKNOWN = 'unknown'

const cache = {
  arch: UNKNOWN,
  type: UNKNOWN,
  platform: UNKNOWN
}

export function arch () {
  if (cache.arch !== UNKNOWN) {
    return cache.arch
  }

  if (typeof window !== 'object') {
    if (typeof process === 'object' && typeof process.arch === 'string') {
      return process.arch
    }
  }

  const value = (
    window.process?.arch ||
    ipc.sendSync('getPlatformArch')?.data ||
    UNKNOWN
  )

  if (value === 'arm64') {
    return value
  }

  cache.arch = value
    .replace('x86_64', 'x64')
    .replace('x86', 'ia32')
    .replace(/arm.*/, 'arm')

  return cache.arch
}

export function networkInterfaces () {
  const { ipv4, ipv6 } = ipc.sendSync('getNetworkInterfaces')?.data || {}
  const interfaces = {}

  for (const type in ipv4) {
    const address = ipv4[type]
    const family = 'IPv4'

    let internal = false
    let netmask = '255.255.255.0'
    let cidr = `${address}/24`
    let mac = null

    if (address === '127.0.0.1' || address === '0.0.0.0') {
      internal = true
      mac = '00:00:00:00:00:00'

      if (address === '127.0.0.1') {
        cidr = '127.0.0.1/8'
        netmask = '255.0.0.0'
      } else {
        cidr = '0.0.0.0/0'
        netmask = '0.0.0.0'
      }
    }

    interfaces[type] = interfaces[type] || []
    interfaces[type].push({
      address,
      netmask,
      internal,
      family,
      cidr,
      mac
    })
  }

  for (const type in ipv6) {
    const address = ipv6[type]
    const family = 'IPv6'

    let internal = false
    let netmask = 'ffff:ffff:ffff:ffff::'
    let cidr = `${address}/64`
    let mac = null

    if (address === '::1') {
      internal = true
      netmask = 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
      cidr = '::1/128'
      mac = '00:00:00:00:00:00'
    }

    interfaces[type] = interfaces[type] || []
    interfaces[type].push({
      address,
      netmask,
      internal,
      family,
      cidr,
      mac
    })
  }

  return interfaces
}

export function platform () {
  if (cache.platform !== UNKNOWN) {
    return cache.platform
  }

  if (typeof window !== 'object') {
    if (typeof process === 'object' && typeof process.platform === 'string') {
      return process.platform
    }
  }

  cache.platform = (
    window.process?.os ||
    ipc.sendSync('getPlatformOS')?.data ||
    window.process?.platform ||
    UNKNOWN
  )

  return cache.platform
}

export function type () {
  if (cache.type !== UNKNOWN) {
    return cache.type
  }

  if (typeof window !== 'object') {
    switch (platform()) {
      case 'linux': return 'Linux'
      case 'darnwin': return 'Darwin'
      case 'win32': return 'Windows' // Windows_NT?
    }
  }

  const value = (
    window.process?.platform ||
    ipc.sendSync('getPlatformType')?.data ||
    UNKNOWN
  )

  cache.type = value

  return toProperCase(cache.type)
}

export const EOL = (() => {
  if (/win/i.test(type())) {
    return '\r\n'
  }

  return '\n'
})()
