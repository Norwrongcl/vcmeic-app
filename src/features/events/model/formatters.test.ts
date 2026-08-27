import { describe, expect, it } from 'vitest'
import { formatClp, formatEventDate, formatEventDateTime } from './formatters'

describe('Chilean event formatting', () => {
  it('formats CLP without decimals', () => {
    expect(formatClp(1_250_000)).toMatch(/^\$1\.250\.000/)
  })

  it('formats local date-only values without shifting the day', () => {
    expect(formatEventDate('2026-09-10')).toContain('10 sept 2026')
  })

  it('formats local date-time values with their entered time', () => {
    expect(formatEventDateTime('2026-09-10T09:30')).toContain('09:30')
  })
})
