/**
 * Unit tests for cache key strategy
 */

import { describe, expect, it } from 'vitest'

import {
  generateCacheKey,
  generateModelNamespace,
  validateCacheKeyComponents,
} from '../key-strategy'
import type { CacheKeyComponents } from '../types'

describe('Key Strategy', () => {
  describe('generateCacheKey', () => {
    it('should generate consistent keys for same input', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key1 = generateCacheKey(components)
      const key2 = generateCacheKey(components)

      expect(key1).toBe(key2)
      expect(key1).toHaveLength(32) // MD5 hash length
    })

    it('should generate different keys for different inputs', () => {
      const components1: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'fr',
        modelId: 'ollama:llama3',
      }

      const key1 = generateCacheKey(components1)
      const key2 = generateCacheKey(components2)

      expect(key1).not.toBe(key2)
    })

    it('should normalize text consistently', () => {
      const components1: CacheKeyComponents = {
        sourceText: '  Hello   world  \n\n',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key1 = generateCacheKey(components1)
      const key2 = generateCacheKey(components2)

      expect(key1).toBe(key2)
    })
  })

  describe('generateModelNamespace', () => {
    it('should generate correct namespace for models with version suffixes', () => {
      const components: CacheKeyComponents = {
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'llama3:8b',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('llama3')
    })

    it('should generate correct namespace for models with parameter specifications', () => {
      const components: CacheKeyComponents = {
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'deepseek-r1:32b',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('deepseek')
    })

    it('should generate correct namespace for complex model names', () => {
      const components: CacheKeyComponents = {
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'phi-3-mini',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('phi')
    })

    it('should handle simple model names', () => {
      const components: CacheKeyComponents = {
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'gpt-4-turbo',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('gpt')
    })

    it('should handle unknown models by returning base name', () => {
      const components: CacheKeyComponents = {
        sourceText: 'test',
        targetLanguage: 'es',
        modelId: 'unknown-model-123',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('unknown')
    })
  })

  describe('validateCacheKeyComponents', () => {
    it('should validate correct components', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const isValid = validateCacheKeyComponents(components)
      expect(isValid).toBe(true)
    })

    it('should reject empty source text', () => {
      const components: CacheKeyComponents = {
        sourceText: '',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const isValid = validateCacheKeyComponents(components)
      expect(isValid).toBe(false)
    })

    it('should reject invalid language code', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'invalid-lang',
        modelId: 'ollama:llama3',
      }

      const isValid = validateCacheKeyComponents(components)
      expect(isValid).toBe(false)
    })

    it('should reject very large text', () => {
      const components: CacheKeyComponents = {
        sourceText: 'x'.repeat(60000), // Exceeds 50KB limit
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const isValid = validateCacheKeyComponents(components)
      expect(isValid).toBe(false)
    })

    it('should accept valid language codes', () => {
      const validLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'en-US', 'zh-CN']

      validLanguages.forEach((lang) => {
        const components: CacheKeyComponents = {
          sourceText: 'Hello world',
          targetLanguage: lang,
          modelId: 'ollama:llama3',
        }

        const isValid = validateCacheKeyComponents(components)
        expect(isValid).toBe(true)
      })
    })
  })
})
