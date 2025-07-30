import { beforeAll, describe, expect, it } from 'vitest'

import { resetFakeBrowser } from '@/tests/utils/fake-browser'

import { useGlobalI18n } from '.'

describe('prompt builder', () => {
  beforeAll(() => {
    resetFakeBrowser()
  })

  it('should format duration correctly', async () => {
    const i18n = await useGlobalI18n()
    expect(i18n.formatDuration(1)).toBe('1 second')
    expect(i18n.formatDuration(2)).toBe('2 seconds')
    expect(i18n.formatDuration(60)).toBe('1 minute')
    expect(i18n.formatDuration(60 * 3)).toBe('3 minutes')
    expect(i18n.formatDuration(3600)).toBe('1 hour')
    expect(i18n.formatDuration(3600 * 3)).toBe('3 hours')
    expect(i18n.formatDuration(3600 * 24)).toBe('1 day')
    expect(i18n.formatDuration(3600 * 24 * 3)).toBe('3 days')
    expect(i18n.formatDuration(3600 * 24 * 30)).toBe('1 month')
    expect(i18n.formatDuration(3600 * 24 * 30 * 3)).toBe('3 months')
    expect(i18n.formatDuration(3600 * 24 * 365)).toBe('1 year')
    expect(i18n.formatDuration(3600 * 24 * 365 * 3)).toBe('3 years')
  })
})
