# Centralized Translation Cache Architecture

This document describes the new centralized IndexedDB translation cache system that enables cross-tab cache sharing and improved performance.

## 🎯 **Problem Solved**

The previous implementation created separate database instances for each browser tab/content script, leading to:

- **Data Isolation**: Each tab maintained its own cache, missing reuse opportunities
- **Storage Fragmentation**: Quota was split across multiple database instances
- **Uncoordinated Management**: Cleanup and analytics weren't synchronized across tabs

## 🏗️ **New Architecture**

### **Centralized Background Service**

```
┌─────────────────────────────────────────────────────────────┐
│                    Background Script                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            BackgroundCacheService                       │ │
│  │  • Single IndexedDB database (using idb package)       │ │
│  │  • Centralized cleanup and analytics                   │ │
│  │  • Coordinated configuration management                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ RPC Communication
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Content Scripts (Tabs)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ RpcTranslation- │  │ RpcTranslation- │  │ RpcTranslation- │ │
│  │ CacheManager    │  │ CacheManager    │  │ CacheManager    │ │
│  │ (Tab 1)         │  │ (Tab 2)         │  │ (Tab 3)         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### **Key Components**

#### 1. **BackgroundCacheService** (`entrypoints/background/cache-service.ts`)

- **Single Database**: One IndexedDB instance shared across all tabs
- **idb Package**: Modern IndexedDB wrapper for better performance and API
- **Centralized Operations**: All cache operations go through this service
- **Coordinated Cleanup**: Single cleanup process for all cached data

#### 2. **RpcTranslationCacheManager** (`utils/translation-cache/rpc-cache-manager.ts`)

- **Proxy Pattern**: Acts as a proxy to the background service
- **RPC Communication**: Uses existing `birpc` system for tab ↔ background communication
- **Local Memory Cache**: Fast L1 cache for frequently accessed translations
- **Fallback Storage**: Local storage when RPC is unavailable
- **Performance Optimizations**: Request deduplication and batching

#### 3. **RPC Functions** (`utils/rpc/background-fns.ts`)

- `cacheGetEntry(id)`: Retrieve translation by cache key
- `cacheSetEntry(entry)`: Store translation entry
- `cacheDeleteEntry(id)`: Remove translation entry
- `cacheGetStats()`: Get cache statistics
- `cacheClear()`: Clear all cache data
- `cacheUpdateConfig()`: Reload cache configuration from user-config
- `cacheGetConfig()`: Get current configuration
- `cacheGetDebugInfo()`: Get debug information about cache service

## 🚀 **Benefits**

### **Cross-Tab Cache Sharing**

- Translation performed in Tab 1 is immediately available in Tab 2
- Dramatically improved cache hit rates
- Reduced redundant API calls to LLM services

### **Unified Storage Management**

- Single storage quota for all tabs
- Coordinated cleanup prevents storage bloat
- Centralized analytics provide complete usage picture

### **Better Performance**

- **Request Deduplication**: Multiple tabs requesting same translation share the result
- **Batching**: Multiple cache writes are batched for efficiency
- **Memory + Persistent**: Two-tier caching (memory → IndexedDB)
- **Fallback Storage**: Graceful degradation when RPC fails

### **Improved Reliability**

- **Error Handling**: Robust error handling with automatic retry
- **Fallback Mechanisms**: Local storage when background script unavailable
- **Connection Recovery**: Automatic reconnection attempts

## 🔄 **Data Flow**

### **Cache Read Operation**

```
1. Content Script calls cacheManager.get(components)
2. Check local memory cache (instant if hit)
3. If miss, call background service via RPC
4. Background service queries IndexedDB
5. Result returned via RPC to content script
6. Content script caches result in memory for future use
```

### **Cache Write Operation**

```
1. Content Script calls cacheManager.set(components, translation)
2. Store immediately in local memory cache
3. Queue for batch write to background service
4. Background service stores in IndexedDB
5. Update metadata and analytics
```

### **Cross-Tab Sharing**

```
Tab A: Translates "Hello" → "Hola" → Stored in background IndexedDB
Tab B: Requests "Hello" → Background returns "Hola" → Instant result
```

## 🛠️ **Implementation Details**

### **RPC Communication**

Uses the existing `birpc` system in the codebase:

```typescript
// Content script to background
const result = await c2bRpc.cacheGetEntry(cacheKey);

// Background function
async function cacheGetEntry(id: string) {
  return await backgroundCacheService.getEntry(id);
}
```

### **Performance Optimizations**

#### **Request Deduplication**

```typescript
// Multiple concurrent requests for same key share one RPC call
const pendingRequests = new Map<string, Promise<TranslationEntry | null>>();
```

#### **Batching**

```typescript
// Multiple set operations are batched with 50ms delay
private batchQueue: Array<{ key: string; entry: TranslationEntry }>
private batchDelay = 50 // milliseconds
```

#### **Memory Cache**

```typescript
// LRU cache for frequently accessed translations
private memoryCache = new LRUCache<string, string>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
})
```

### **Error Handling & Fallback**

#### **RPC Failure Handling**

```typescript
// Automatic retry with exponential backoff
private rpcRetryCount = 0
private maxRpcRetries = 3
private rpcRetryDelay = 1000 // 1 second
```

#### **Fallback Storage**

```typescript
// Local Map-based storage when RPC unavailable
private fallbackStorage = new Map<string, { entry: TranslationEntry; timestamp: number }>()
```

## 📊 **Monitoring & Diagnostics**

### **Cache Statistics**

```typescript
import { translationCache } from "@/utils/translation-cache";

const stats = await translationCache.getStats();
// Returns:
// - totalEntries: number
// - totalSizeMB: number
// - modelNamespaces: string[]
```

### **Debug Information**

```typescript
import { c2bRpc } from "@/utils/rpc";

const debugInfo = await c2bRpc.cacheGetDebugInfo();
// Returns:
// - isInitialized: boolean
// - extensionId: string
// - contextInfo: object with location, service worker status, etc.
```

## 🔧 **Configuration**

### **Background Service Config**

```typescript
// Centralized configuration in background script
const config: CacheConfig = {
  enabled: true,
  retentionDays: 30,
  enableAnalytics: true,
};
```

### **Per-Tab Usage**

```typescript
// Each tab uses the same RPC-based cache manager
import { translationCache } from "@/utils/translation-cache";

// All operations are automatically routed to background service
const cached = await translationCache.get(components);
await translationCache.set(components, translatedText);
```

## 🧪 **Testing**

### **RPC Mocking**

```typescript
// Mock RPC system for testing
const mockRpc = {
  ping: vi.fn(() => Promise.resolve("pong")),
  cacheGetEntry: vi.fn(() => Promise.resolve(null)),
  cacheSetEntry: vi.fn(() => Promise.resolve({ success: true })),
  // ... other methods
};
```

### **Integration Tests**

- Cross-tab cache sharing scenarios
- RPC failure and recovery
- Performance optimization verification
- Fallback storage functionality

## 🔄 **Migration Path**

### **Backward Compatibility**

The new system maintains the same API as the original:

```typescript
// Same interface, different implementation
const cached = await translationCache.get(components);
await translationCache.set(components, translation);
```

### **Automatic Upgrade**

- Existing code works without changes
- New `translationCache` singleton uses `RpcTranslationCacheManager`
- Old `TranslationCacheManager` still available for direct use

## 🎯 **Results**

### **Performance Improvements**

- **Cache Hit Rate**: Significantly improved due to cross-tab sharing
- **Storage Efficiency**: Single database eliminates duplication
- **Response Time**: Memory cache + RPC optimization reduces latency

### **User Experience**

- **Faster Translations**: Previously translated text appears instantly in new tabs
- **Consistent Performance**: Coordinated cleanup prevents storage issues
- **Better Reliability**: Fallback mechanisms ensure cache always works

### **Developer Experience**

- **Same API**: No code changes required for existing translation code
- **Better Debugging**: Centralized analytics and monitoring
- **Easier Testing**: Comprehensive test coverage with RPC mocking

This centralized architecture transforms the translation cache from a per-tab limitation into a powerful cross-tab acceleration system! 🚀
