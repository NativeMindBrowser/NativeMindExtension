# Translation Cache System

A centralized RPC-based caching solution for translation functionality with cross-tab sharing and performance optimization.

## Features

- **Cross-Tab Cache Sharing**: Single cache shared across all browser tabs via background service
- **RPC Communication**: Efficient communication using existing birpc system
- **Centralized Management**: All cache operations handled by background script
- **Configurable Retention**: Default 30-day cache retention with user configuration support
- **Performance Optimization**: Request deduplication, batching, and memory caching
- **Fallback Storage**: Graceful degradation when RPC is unavailable
- **Automatic Cleanup**: Background expiration and size management handled centrally
- **Model Isolation**: Separate cache namespaces for different LLM models

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Content Scripts (Tabs)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ RpcTranslation- │  │ RpcTranslation- │  │ RpcTranslation- │ │
│  │ CacheManager    │  │ CacheManager    │  │ CacheManager    │ │
│  │ (Tab 1)         │  │ (Tab 2)         │  │ (Tab 3)         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              │ RPC Communication
                              ▼
┌──────────────────────────────────────────────────────────────┐
│            Background Script (Service Workers)               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            BackgroundCacheService                       │ │
│  │  • Single IndexedDB database (using idb package)        │ │
│  │  • Centralized cleanup                                  │ │
│  │  • Coordinated configuration management                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│            IndexedDB Storage (Service Workers)                 │
│  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Translations   │  │    Metadata     │ │
│  │     Store       │  │     Store       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import { translationCache } from "@/utils/translation-cache";

// Get a cached translation (uses RPC to background service)
const cached = await translationCache.get({
  sourceText: "Hello world",
  targetLanguage: "es",
  modelId: "ollama:llama3",
});

// Store a translation (batched for performance)
await translationCache.set(
  {
    sourceText: "Hello world",
    targetLanguage: "es",
    modelId: "ollama:llama3",
  },
  "Hola mundo"
);

// Get cache statistics
const stats = await translationCache.getStats();
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Cache size: ${stats.totalSizeMB.toFixed(2)} MB`);
console.log(`Model namespaces: ${stats.modelNamespaces.join(", ")}`);

// Clear all cached translations
await translationCache.clear();
```

### Configuration

Cache configuration is managed through the user configuration system:

```typescript
import { getUserConfig } from "@/utils/user-config";

const userConfig = await getUserConfig();

// Check current cache settings
const isEnabled = userConfig.translation.cache.enabled.get();
const retentionDays = userConfig.translation.cache.retentionDays.get();

// Update cache configuration (triggers background service update)
await userConfig.translation.cache.enabled.set(true);
await userConfig.translation.cache.retentionDays.set(60);
```

### Monitoring

```typescript
import { translationCache } from "@/utils/translation-cache";
import { c2bRpc } from "@/utils/rpc";

// Get cache statistics
const stats = await translationCache.getStats();
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Cache size: ${stats.totalSizeMB.toFixed(2)} MB`);
console.log(`Model namespaces: ${stats.modelNamespaces.join(", ")}`);

// Get debug information (background service only)
const debugInfo = await c2bRpc.cacheGetDebugInfo();
console.log("Cache debug info:", debugInfo);

// Get current configuration
const config = await c2bRpc.cacheGetConfig();
console.log("Cache configuration:", config);
```

## API Reference

### Core Classes

#### RpcTranslationCacheManager

Main interface for cache operations via RPC to background service.

```typescript
class RpcTranslationCacheManager {
  async get(components: CacheKeyComponents): Promise<string | null>;
  async set(
    components: CacheKeyComponents,
    translatedText: string
  ): Promise<CacheOperationResult>;
  async getStats(): Promise<CacheStats>;
  async clear(): Promise<CacheOperationResult>;
  async updateConfig(): Promise<void>;
}
```

#### Background Cache Service

The centralized cache service running in the background script.

```typescript
class BackgroundCacheService {
  async getEntry(id: string): Promise<TranslationEntry | null>;
  async setEntry(entry: TranslationEntry): Promise<CacheOperationResult>;
  async deleteEntry(id: string): Promise<CacheOperationResult>;
  async getStats(): Promise<CacheStats>;
  async clear(): Promise<CacheOperationResult>;
  async loadUserConfig(): Promise<void>;
  getConfig(): CacheConfig;
  async expireOldEntries(): Promise<{
    success: boolean;
    removedCount: number;
    error?: string;
  }>;
}
```

### Types

#### CacheKeyComponents

```typescript
interface CacheKeyComponents {
  sourceText: string;
  targetLanguage: string;
  modelId: string;
  systemPrompt?: string;
}
```

#### CacheConfig

```typescript
interface CacheConfig {
  enabled: boolean;
  maxSizeMB: number;
  retentionDays: number;
  maxEntriesPerModel: number;
}
```

#### TranslationEntry

```typescript
interface TranslationEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  targetLanguage: string;
  modelId: string;
  modelNamespace: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  textHash: string;
  size: number;
  systemPromptHash?: string;
}
```

## Cache Key Strategy

The cache uses a sophisticated key generation strategy:

1. **Text Normalization**: Source text is normalized to handle minor variations
2. **Model Isolation**: Different models get separate cache namespaces
3. **Language Separation**: Same text in different target languages are cached separately
4. **Prompt Awareness**: Different system prompts create different cache entries

### Key Format

```
Cache Key: MD5(normalizedText + targetLanguage + modelId + promptHash)
Namespace: endpointType:modelName (e.g., "ollama:llama3", "webllm:phi3")
```

## Storage Schema

### IndexedDB Structure

- **Database**: `NativeMindTranslationCache`
- **Version**: 1
- **Object Stores**:
  - `translations`: Translation entries with indexes on modelNamespace, createdAt, lastAccessedAt
  - `metadata`: Cache metadata and statistics

### Indexes

- `modelNamespace`: For model-specific queries
- `createdAt`: For cleanup operations
- `lastAccessedAt`: For LRU cleanup
- `textHash`: For similarity matching
- `modelNamespace_targetLanguage`: Compound index for efficient filtering

## Performance Considerations

### Memory Usage

- In-memory LRU cache (500 entries) for frequently accessed translations
- Lazy loading of IndexedDB entries
- Automatic cleanup when size limits are exceeded

### Storage Optimization

- Text normalization reduces duplicate entries
- Configurable size limits prevent unbounded growth
- Batch operations for bulk inserts/updates

### Query Performance

- Strategic indexing for common query patterns
- Connection pooling and reuse
- Asynchronous operations to avoid blocking

## Configuration Options

### User Configuration

Cache settings are integrated with the existing user configuration system:

```typescript
// In utils/user-config/index.ts
translation: {
  cache: {
    enabled: boolean (default: true)
    retentionDays: number (default: 30)
  }
}
```

### Runtime Configuration

```typescript
import { getUserConfig } from "@/utils/user-config";
import { c2bRpc } from "@/utils/rpc";

// Update cache settings through user config
const userConfig = await getUserConfig();
await userConfig.translation.cache.enabled.set(true);
await userConfig.translation.cache.retentionDays.set(60);

// Notify background service to reload configuration
await c2bRpc.cacheUpdateConfig();
```

## Monitoring

### Health Monitoring

The system provides comprehensive health monitoring:

- Cache size vs. limits
- Entry count tracking
- Last cleanup time
- Performance metrics

- Hit/miss ratios
- Response times
- Entry addition/removal rates
- Daily statistics

### Diagnostics

- IndexedDB support detection
- Connection testing
- Performance benchmarking
- Storage quota information

## Error Handling

The cache system is designed to be resilient:

- Graceful degradation when IndexedDB is unavailable
- Automatic retry logic for connection failures
- Fallback to memory-only caching when persistent storage fails
- Comprehensive error logging

## Migration and Versioning

The system supports schema migrations:

- Version-aware database initialization
- Automatic schema validation
- Migration scripts for future versions
- Backward compatibility considerations

## Best Practices

### For Developers

1. **Always check cache first** before making translation requests
2. **Use appropriate cache keys** including model and prompt information
3. **Handle cache failures gracefully** with fallback to direct translation
4. **Monitor cache performance** using provided monitoring tools
5. **Configure appropriate limits** based on user device capabilities

### For Users

1. **Regular cleanup** helps maintain performance
2. **Adjust retention period** based on usage patterns
3. **Monitor storage usage** to prevent quota issues

## Troubleshooting

### Common Issues

1. **Cache not working**: Check IndexedDB support and permissions
2. **High memory usage**: Reduce maxEntriesPerModel or enable more frequent cleanup
3. **Slow performance**: Check for storage quota issues or large cache size
4. **Missing translations**: Verify cache keys and model namespaces

### Debug Tools

```typescript
import { translationCache } from "@/utils/translation-cache";
import { c2bRpc } from "@/utils/rpc";

// Get cache statistics
const stats = await translationCache.getStats();
console.log("Cache stats:", stats);

// Get debug information from background service
const debugInfo = await c2bRpc.cacheGetDebugInfo();
console.log("Debug info:", debugInfo);

// Clear all cache data
await translationCache.clear();
console.log("Cache cleared");

// Get current configuration
const config = await c2bRpc.cacheGetConfig();
console.log("Current config:", config);
```

## Future Enhancements

- Cross-tab cache synchronization
- Compression for large translations
- Fuzzy matching for similar texts
- Export/import functionality
- Advanced analytics dashboard
- Machine learning-based cache optimization
