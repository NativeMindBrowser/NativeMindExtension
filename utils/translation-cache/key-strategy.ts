/**
 * Cache key generation strategy and model isolation
 */

import md5 from 'md5'

import { type CacheKeyComponents } from './types'

/**
 * Generate a unique cache key for translation entries
 *
 * The key is generated using an MD5 hash of:
 * - Source text (normalized)
 * - Target language
 * - Model ID
 *
 * This ensures that the same text with different models or languages
 * gets different cache entries.
 */
export function generateCacheKey(components: CacheKeyComponents): string {
  const { sourceText, targetLanguage, modelId } = components

  // Normalize source text to handle minor variations
  const normalizedText = normalizeText(sourceText)

  // Create a composite string for hashing
  const composite = [
    normalizedText,
    targetLanguage.toLowerCase(),
    modelId.toLowerCase(),
  ].join('|')

  // Generate MD5 hash for the cache key
  return md5(composite)
}

/**
 * Generate a model namespace for isolation
 *
 * Returns the base model name for cache isolation.
 * Examples:
 * - "deepseek"
 * - "llama3"
 * - "phi3"
 */
export function generateModelNamespace(components: CacheKeyComponents): string {
  const { modelId } = components

  // Extract base model name from modelId
  const modelName = extractModelName(modelId)

  return modelName
}

/**
 * Normalize text for consistent caching
 *
 * This function:
 * - Trims whitespace
 * - Normalizes line endings
 * - Removes excessive whitespace
 * - Handles HTML entities consistently
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .replace(/[ \t]{2,}/g, ' ') // Normalize multiple spaces/tabs
    .replace(/&nbsp;/g, ' ') // Normalize non-breaking spaces
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&') // Normalize HTML entities (moved to end)
}

/**
 * Extract model name from model ID
 *
 * Extracts the base model name by removing version suffixes and parameter specifications.
 * Examples:
 * - "deepseek-r1:32b" → "deepseek"
 * - "deepseek-r1:8b" → "deepseek"
 * - "llama3:8b" → "llama3"
 */
function extractModelName(modelId: string): string {
  // Handle edge cases
  if (!modelId || typeof modelId !== 'string') {
    return ''
  }

  // Remove common prefixes first
  const modelName = modelId
    .toLowerCase()
    .replace(/^(ollama|webllm|openai|anthropic|chrome-ai)[/:]?/, '')

  // Extract base model name by removing version suffixes and parameter specifications
  // Split on both '-' and ':' to handle patterns like "deepseek-r1:32b"
  const parts = modelName.split(/[-:]/)

  if (parts.length === 0) {
    return modelId.toLowerCase()
  }

  // Take the first part as the base model name
  let baseName = parts[0].trim()

  // Handle empty base name
  if (!baseName) {
    return modelId.toLowerCase()
  }

  // Remove common suffixes from the base name
  baseName = baseName.replace(/[-_]?(chat|instruct|base)$/, '')

  return baseName || modelId.toLowerCase()
}

/**
 * Validate cache key components
 */
export function validateCacheKeyComponents(components: CacheKeyComponents): boolean {
  const { sourceText, targetLanguage, modelId } = components

  // Check required fields
  if (!sourceText || !targetLanguage || !modelId) {
    return false
  }

  // Check text length (avoid caching very large texts)
  if (sourceText.length > 50000) { // 50KB limit
    return false
  }

  // Check language code format
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(targetLanguage)) {
    return false
  }

  // Check model ID format
  if (modelId.length < 2 || modelId.length > 100) {
    return false
  }

  return true
}
