# Singleton Pattern Architecture for Background Services

## 🎯 **Elegant Singleton Pattern Implementation**

We have adopted the singleton pattern to manage background services, avoiding the use of global variables while providing better type safety and resource management. Backward compatibility with global variables is maintained for debugging purposes.

## 🏗️ **Current Architecture**

### **Main Architecture: Elegant Singleton Pattern**

```typescript
// ✅ Type-safe singleton manager
export class BackgroundCacheServiceManager {
  private static instance: BackgroundCacheService | null = null;

  static async initialize(
    databaseManager: BackgroundDatabaseManager
  ): Promise<BackgroundCacheService> {
    if (!this.instance) {
      const service = new BackgroundCacheService(databaseManager);
      try {
        await service.initialize();
        this.instance = service;
      } catch (error) {
        // If initialization fails, don't set the instance
        log.error(
          "[BackgroundCacheServiceManager] Failed to initialize cache service:",
          error
        );
        throw error;
      }
    }
    return this.instance;
  }

  static getInstance(): BackgroundCacheService | null {
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}

// In RPC functions
const service = BackgroundCacheServiceManager.getInstance();
```

### **Compatibility Support: Global Variables (For Debugging Only)**

```typescript
// Set global variables after background script initialization for debugging purposes
// @ts-expect-error - this is a global variable
globalThis.backgroundCacheService = BackgroundCacheServiceManager.getInstance();

// @ts-expect-error - this is a global variable
globalThis.backgroundChatHistoryService =
  BackgroundChatHistoryServiceManager.getInstance();

// @ts-expect-error - this is a global variable
globalThis.databaseManager = databaseManager;
```

## 🚀 **Advantage Comparison**

| Feature               | Global Variable Approach | Singleton Pattern                 |
| --------------------- | ------------------------ | --------------------------------- |
| **Type Safety**       | ❌ `any` type            | ✅ Complete type inference        |
| **IDE Support**       | ❌ No IntelliSense       | ✅ Full IntelliSense              |
| **Error Detection**   | ❌ Runtime errors        | ✅ Compile-time detection         |
| **Test Friendly**     | ❌ Hard to reset state   | ✅ `reset()` method               |
| **Code Readability**  | ❌ Implicit dependencies | ✅ Explicit dependency management |
| **Memory Management** | ❌ Manual management     | ✅ Automatic lifecycle            |

## 📋 **Usage**

### **1. Initialize in Background Script**

```typescript
// entrypoints/background/index.ts
import { BackgroundDatabaseManager } from "./database";
import { BackgroundCacheServiceManager } from "./services/cache-service";
import { BackgroundChatHistoryServiceManager } from "./services/chat-history-service";

// Initialize the background services with shared database
async function initializeBackgroundServices() {
  try {
    logger.debug("Starting background services initialization");

    // Initialize shared database manager
    const databaseManager = BackgroundDatabaseManager.getInstance();
    await databaseManager.initialize();
    logger.debug("Shared database manager initialized successfully");

    // Initialize services using singleton managers
    await BackgroundCacheServiceManager.initialize(databaseManager);
    logger.debug("Background cache service initialized successfully");

    await BackgroundChatHistoryServiceManager.initialize(databaseManager);
    logger.debug("Background chat history service initialized successfully");

    // Initialize translation cache (RPC-based cache manager)
    await translationCache.initialize();
    logger.debug("Translation cache initialized successfully");

    // Set up global debugging variables
    // @ts-expect-error - this is a global variable
    globalThis.backgroundCacheService =
      BackgroundCacheServiceManager.getInstance();
    // @ts-expect-error - this is a global variable
    globalThis.backgroundChatHistoryService =
      BackgroundChatHistoryServiceManager.getInstance();
    // @ts-expect-error - this is a global variable
    globalThis.databaseManager = databaseManager;

    logger.debug("All background services initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize background services:", error);
  }
}
```

### **2. Use in RPC Functions**

```typescript
// utils/rpc/background-fns.ts
import { BackgroundCacheServiceManager } from "../../entrypoints/background/services/cache-service";
import { BackgroundChatHistoryServiceManager } from "../../entrypoints/background/services/chat-history-service";

// Cache service RPC functions
export async function cacheGetEntry(id: string) {
  try {
    const service = BackgroundCacheServiceManager.getInstance();
    return (await service?.getEntry(id)) || null;
  } catch (error) {
    logger.error("Cache RPC getEntry failed:", error);
    return null;
  }
}

export async function cacheSetEntry(entry: TranslationEntry) {
  try {
    const service = BackgroundCacheServiceManager.getInstance();
    return (
      (await service?.setEntry(entry)) || {
        success: false,
        error: "Service not available",
      }
    );
  } catch (error) {
    logger.error("Cache RPC setEntry failed:", error);
    return { success: false, error: String(error) };
  }
}

// Chat history service RPC functions
export async function chatHistoryGetChatHistory(chatId: string) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance();
    return (await service?.getChatHistory(chatId)) || null;
  } catch (error) {
    logger.error("Chat history RPC getChatHistory failed:", error);
    return null;
  }
}

export async function chatHistorySaveChatHistory(chatHistory: ChatHistoryV1) {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance();
    return (
      (await service?.saveChatHistory(chatHistory)) || {
        success: false,
        error: "Service not available",
      }
    );
  } catch (error) {
    logger.error("Chat history RPC saveChatHistory failed:", error);
    return { success: false, error: String(error) };
  }
}

export async function chatHistoryGetChatList() {
  try {
    const service = BackgroundChatHistoryServiceManager.getInstance();
    return (await service?.getChatList()) || [];
  } catch (error) {
    logger.error("Chat history RPC getChatList failed:", error);
    return [];
  }
}
```

### **3. Call via RPC in Any Context**

```typescript
// In sidepanel, content script, or anywhere else
import { c2bRpc } from "@/utils/rpc";

// Get chat history
const chatHistory = await c2bRpc.chatHistoryGetChatHistory("chat-id-123");

// Save chat history
await c2bRpc.chatHistorySaveChatHistory({
  id: "chat-id-123",
  title: "New Conversation",
  lastInteractedAt: Date.now(),
  history: [
    { role: "user", content: "Hello!", done: true },
    { role: "assistant", content: "Hello! How can I help you?", done: true },
  ],
});

// Get chat list
const chatList = await c2bRpc.chatHistoryGetChatList();

// Cache operations
const cacheEntry = await c2bRpc.cacheGetEntry("translation-key");
await c2bRpc.cacheSetEntry({
  id: "translation-key",
  modelNamespace: "gpt-4",
  sourceText: "Hello",
  translatedText: "你好",
  targetLanguage: "zh-CN",
  createdAt: Date.now(),
  lastAccessedAt: Date.now(),
  accessCount: 1,
  textHash: "hash-value",
  size: 0,
  modelId: "gpt-4",
});
```

### **4. Use in Tests**

```typescript
// entrypoints/background/__tests__/shared-database-architecture.test.ts
import { BackgroundDatabaseManager } from "../database";
import { BackgroundCacheServiceManager } from "../services/cache-service";
import { BackgroundChatHistoryServiceManager } from "../services/chat-history-service";

describe("Background Services Integration", () => {
  beforeEach(async () => {
    // Reset singleton state
    BackgroundCacheServiceManager.reset();
    BackgroundChatHistoryServiceManager.reset();

    // Re-initialize
    const databaseManager = BackgroundDatabaseManager.getInstance();
    await databaseManager.initialize();
    await BackgroundCacheServiceManager.initialize(databaseManager);
    await BackgroundChatHistoryServiceManager.initialize(databaseManager);
  });

  afterEach(async () => {
    // Clean up after each test
    const databaseManager = BackgroundDatabaseManager.getInstance();
    await databaseManager.destroyDatabase();
  });

  it("should handle cache service operations", async () => {
    const service = BackgroundCacheServiceManager.getInstance()!;
    expect(service).toBeTruthy();

    // Test cache operations
    const entry = {
      id: "test-key",
      modelNamespace: "test-model",
      sourceText: "Hello",
      translatedText: "你好",
      targetLanguage: "zh-CN",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      textHash: "test-hash",
      size: 0,
      modelId: "test-model",
    };

    const setResult = await service.setEntry(entry);
    expect(setResult.success).toBe(true);

    const retrievedEntry = await service.getEntry("test-key");
    expect(retrievedEntry).toBeTruthy();
    expect(retrievedEntry?.sourceText).toBe("Hello");
  });
});
```

## 🔧 **Implementation Details**

### **Database Manager Singleton**

```typescript
// entrypoints/background/database/index.ts
export class BackgroundDatabaseManager {
  private db: IDBPDatabase<BackgroundDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;
  private static instance: BackgroundDatabaseManager | null = null;

  private constructor() {}

  static getInstance(): BackgroundDatabaseManager {
    if (!this.instance) {
      this.instance = new BackgroundDatabaseManager();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this._initialize();
    return this.initPromise;
  }

  getDatabase(): IDBPDatabase<BackgroundDBSchema> | null {
    return this.db;
  }
}
```

### **Service Manager Concrete Implementation**

```typescript
// BackgroundCacheServiceManager implementation
export class BackgroundCacheServiceManager {
  private static instance: BackgroundCacheService | null = null;

  static async initialize(
    databaseManager: BackgroundDatabaseManager
  ): Promise<BackgroundCacheService> {
    if (!this.instance) {
      const service = new BackgroundCacheService(databaseManager);
      try {
        await service.initialize();
        this.instance = service;
      } catch (error) {
        log.error(
          "[BackgroundCacheServiceManager] Failed to initialize cache service:",
          error
        );
        throw error;
      }
    }
    return this.instance;
  }

  static getInstance(): BackgroundCacheService | null {
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}

// BackgroundChatHistoryServiceManager implementation
export class BackgroundChatHistoryServiceManager {
  private static instance: BackgroundChatHistoryService | null = null;

  static async initialize(
    databaseManager: BackgroundDatabaseManager
  ): Promise<void> {
    if (this.instance) {
      log.warn("Background chat history service manager already initialized");
      return;
    }

    this.instance = new BackgroundChatHistoryService(databaseManager);
    await this.instance.initialize();
  }

  static getInstance(): BackgroundChatHistoryService | null {
    return this.instance;
  }

  static async shutdown(): Promise<void> {
    this.instance = null;
  }
}
```

### **Type-Safe Service Access**

```typescript
// Complete type inference and null checking
const cacheService = BackgroundCacheServiceManager.getInstance();
if (cacheService) {
  // TypeScript knows this is BackgroundCacheService type
  const entry = await cacheService.getEntry("key"); // ✅ Type safe
  const stats = await cacheService.getStats(); // ✅ IntelliSense
  const config = cacheService.getConfig(); // ✅ Full type support
}

const chatService = BackgroundChatHistoryServiceManager.getInstance();
if (chatService) {
  // TypeScript knows this is BackgroundChatHistoryService type
  const chatList = await chatService.getChatList(); // ✅ Type safe
  const chatHistory = await chatService.getChatHistory(id); // ✅ IntelliSense
  const result = await chatService.saveChatHistory(history); // ✅ Parameter validation
}
```

## 🎉 **Summary**

By adopting the singleton pattern, we have achieved the following in the NativeMind extension:

### **Architectural Advantages**

1. **🔒 Type Safety**: Complete elimination of `any` types, gaining full type checking and IDE support
2. **🏗️ Unified Management**: All background services coordinated through a unified database manager
3. **🧪 Test Friendly**: Easy test state management through `reset()` method, facilitating unit and integration testing
4. **📖 Code Readability**: Explicit dependency management, clearer code structure and separation of concerns
5. **⚡ Resource Efficiency**: Singleton ensures efficient resource utilization, avoiding duplicate initialization
6. **🛡️ Error Handling**: Compile-time detection of potential issues, runtime graceful error recovery mechanisms

### **Practical Applications**

- **BackgroundDatabaseManager**: Manages shared IndexedDB database instances
- **BackgroundCacheServiceManager**: Handles persistent storage of translation cache
- **BackgroundChatHistoryServiceManager**: Manages chat history and context attachments

### **Backward Compatibility**

- Preserves global variables for debugging and development tool access
- Uses TypeScript's `@ts-expect-error` annotation to clearly identify debugging code

This architectural pattern provides an elegant and maintainable foundation for extending more background services (such as user preference management, analytics services, etc.)!
