import { Stats } from './stats.js'

/**
 * @TODO
 */
export class Dir {
  /**
   * @TODO
   */
  constructor (options) {
    this.path = options?.path || null
  }

  /**
   * @TODO
   */
  async close (callback) {
  }

  /**
   * @TODO
   */
  async read (callback) {
  }

  /**
   * @TODO
   */
  [Symbol.asyncIterator] () {
  }
}

/**
 * @TODO
 */
export class Dirent extends Stats {
  /**
   * @TODO
   */
  static from (stat, fromBigInt) {
    const stats = super.from(stat, fromBigInt)
    return new this({
      name: stat.name,
      ...stats
    })
  }

  /**
   * @TODO
   */
  constructor (options) {
    super(options)

    this.name = options?.name || null
  }
}
