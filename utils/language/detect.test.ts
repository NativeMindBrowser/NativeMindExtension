// @ts-expect-error -- guesslanguage has no types
import { guessLanguage } from 'guesslanguage'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import type { LanguageCode } from './detect'
import { detectLanguage, getLanguageName, SUPPORTED_LANGUAGE_CODES } from './detect'

const guessDetectSpy = vi.spyOn(guessLanguage, 'detect')

describe('language detector', () => {
  beforeEach(() => {
    // See https://webext-core.aklinker1.io/fake-browser/reseting-state
    fakeBrowser.reset()
    guessDetectSpy.mockReset()
    guessDetectSpy.mockImplementation((_text: string, cb: (lang: string) => void) => cb('en'))
  })

  it.each(SUPPORTED_LANGUAGE_CODES)('returns the detected code when supported (%s)', async (code) => {
    guessDetectSpy.mockImplementation((_text: string, cb: (lang: string) => void) => cb(code))

    await expect(detectLanguage('sample text')).resolves.toBe(code)
  })

  it('falls back to en when the detected code is not supported', async () => {
    guessDetectSpy.mockImplementation((_text: string, cb: (lang: string) => void) => cb('xx'))

    await expect(detectLanguage('unknown language')).resolves.toBe('en')
  })

  it('returns the language display name or defaults to English', () => {
    expect(getLanguageName('zh')).toBe('简体中文')
    expect(getLanguageName('en')).toBe('English')
    expect(getLanguageName('xx' as LanguageCode)).toBe('English')
  })

  afterAll(() => {
    guessDetectSpy.mockRestore()
  })
})
