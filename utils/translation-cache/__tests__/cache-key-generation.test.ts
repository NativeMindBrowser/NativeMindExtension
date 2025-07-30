import { describe, it, expect } from 'vitest'
import { generateCacheKey, generateModelNamespace } from '../key-strategy'
import type { CacheKeyComponents } from '../types'

describe('Cache Key Generation', () => {
  describe('generateCacheKey', () => {
    it('should generate consistent keys for identical inputs', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key1 = generateCacheKey(components)
      const key2 = generateCacheKey(components)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[a-f0-9]{32}$/) // MD5 hash format
    })

    it('should generate different keys for different source text', () => {
      const components1: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'Goodbye world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key1 = generateCacheKey(components1)
      const key2 = generateCacheKey(components2)

      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different target languages', () => {
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

    it('should generate different keys for different models', () => {
      const components1: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'openai:gpt-4',
      }

      const key1 = generateCacheKey(components1)
      const key2 = generateCacheKey(components2)

      expect(key1).not.toBe(key2)
    })

    it('should handle special characters in source text', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello! @#$%^&*()_+ 世界',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key = generateCacheKey(components)
      expect(key).toMatch(/^[a-f0-9]{32}$/)
    })

    it('should handle empty source text', () => {
      const components: CacheKeyComponents = {
        sourceText: '',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key = generateCacheKey(components)
      expect(key).toMatch(/^[a-f0-9]{32}$/)
    })

    it('should handle very long source text', () => {
      const longText = 'A'.repeat(10000)
      const components: CacheKeyComponents = {
        sourceText: longText,
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const key = generateCacheKey(components)
      expect(key).toMatch(/^[a-f0-9]{32}$/)
    })
  })

  describe('generateModelNamespace', () => {
    it('should generate consistent namespaces for identical inputs', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const namespace1 = generateModelNamespace(components)
      const namespace2 = generateModelNamespace(components)

      expect(namespace1).toBe(namespace2)
    })

    it('should generate different namespaces for different models', () => {
      const components1: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'openai:gpt-4',
      }

      const namespace1 = generateModelNamespace(components1)
      const namespace2 = generateModelNamespace(components2)

      expect(namespace1).not.toBe(namespace2)
    })

    it('should generate same namespace for same model regardless of text', () => {
      const components1: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'Goodbye world',
        targetLanguage: 'fr',
        modelId: 'ollama:llama3',
      }

      const namespace1 = generateModelNamespace(components1)
      const namespace2 = generateModelNamespace(components2)

      expect(namespace1).toBe(namespace2)
    })

    it('should handle complex model IDs', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'provider:model-name-v2.1-fine-tuned',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('provider:model-name-v2.1-fine-tuned')
    })

    it('should handle model IDs with special characters', () => {
      const components: CacheKeyComponents = {
        sourceText: 'Hello world',
        targetLanguage: 'es',
        modelId: 'provider/model@version#1',
      }

      const namespace = generateModelNamespace(components)
      expect(namespace).toBe('provider/model@version#1')
    })
  })

  describe('key collision resistance', () => {
    it('should generate different keys for similar but different inputs', () => {
      const testCases = [
        {
          components1: { sourceText: 'Hello world', targetLanguage: 'es', modelId: 'model1' },
          components2: { sourceText: 'Hello world ', targetLanguage: 'es', modelId: 'model1' }, // trailing space
        },
        {
          components1: { sourceText: 'Hello world', targetLanguage: 'es', modelId: 'model1' },
          components2: { sourceText: 'hello world', targetLanguage: 'es', modelId: 'model1' }, // case difference
        },
        {
          components1: { sourceText: 'Hello world', targetLanguage: 'es', modelId: 'model1' },
          components2: { sourceText: 'Hello world', targetLanguage: 'ES', modelId: 'model1' }, // case difference in language
        },
        {
          components1: { sourceText: 'Hello world', targetLanguage: 'es', modelId: 'model1' },
          components2: { sourceText: 'Hello world', targetLanguage: 'es', modelId: 'Model1' }, // case difference in model
        },
      ]

      testCases.forEach(({ components1, components2 }, index) => {
        const key1 = generateCacheKey(components1)
        const key2 = generateCacheKey(components2)
        expect(key1).not.toBe(key2, `Test case ${index + 1} should generate different keys`)
      })
    })

    it('should handle Unicode normalization consistently', () => {
      // Test with composed and decomposed Unicode characters
      const components1: CacheKeyComponents = {
        sourceText: 'café', // é as single character
        targetLanguage: 'es',
        modelId: 'model1',
      }

      const components2: CacheKeyComponents = {
        sourceText: 'cafe\u0301', // é as e + combining acute accent
        targetLanguage: 'es',
        modelId: 'model1',
      }

      const key1 = generateCacheKey(components1)
      const key2 = generateCacheKey(components2)

      // These should be different because we don't normalize Unicode
      expect(key1).not.toBe(key2)
    })
  })

  describe('performance characteristics', () => {
    it('should generate keys quickly for large inputs', () => {
      const largeText = 'Lorem ipsum '.repeat(1000) // ~12KB text
      const components: CacheKeyComponents = {
        sourceText: largeText,
        targetLanguage: 'es',
        modelId: 'ollama:llama3',
      }

      const startTime = performance.now()
      const key = generateCacheKey(components)
      const endTime = performance.now()

      expect(key).toMatch(/^[a-f0-9]{32}$/)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in less than 100ms
    })

    it('should generate many keys quickly', () => {
      const startTime = performance.now()

      for (let i = 0; i < 1000; i++) {
        const components: CacheKeyComponents = {
          sourceText: `Test message ${i}`,
          targetLanguage: 'es',
          modelId: 'ollama:llama3',
        }
        generateCacheKey(components)
      }

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete 1000 keys in less than 1 second
    })
  })
})
