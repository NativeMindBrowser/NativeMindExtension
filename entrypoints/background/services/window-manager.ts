import { Browser, browser } from 'wxt/browser'

import logger from '@/utils/logger'

/**
 * Window Manager Service for tracking active window IDs
 * This service maintains a cache of the current active window ID to avoid async calls before sidePanel.open()
 */
class WindowManagerService {
  private currentWindowId: number | null = null
  private initialized = false

  /**
   * Initialize the window manager service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Get initial current window
      const currentWindow = await browser.windows.getCurrent()
      this.currentWindowId = currentWindow.id || null
      logger.debug('Window Manager initialized with window ID:', this.currentWindowId)

      // Listen for window focus changes
      browser.windows.onFocusChanged.addListener(this.handleWindowFocusChanged.bind(this))

      // Listen for window created/removed events
      browser.windows.onCreated.addListener(this.handleWindowCreated.bind(this))
      browser.windows.onRemoved.addListener(this.handleWindowRemoved.bind(this))

      this.initialized = true
    }
    catch (error) {
      logger.error('Failed to initialize Window Manager:', error)
      throw error
    }
  }

  /**
   * Get the current cached window ID (synchronous)
   */
  getCurrentWindowId(): number | null {
    return this.currentWindowId
  }

  /**
   * Handle window focus change events
   */
  private handleWindowFocusChanged(windowId: number): void {
    if (windowId !== browser.windows.WINDOW_ID_NONE) {
      this.currentWindowId = windowId
      logger.debug('Active window changed to:', windowId)
    }
  }

  /**
   * Handle window created events
   */
  private handleWindowCreated(window: Browser.windows.Window): void {
    if (window.focused && window.id) {
      this.currentWindowId = window.id
      logger.debug('New focused window created:', window.id)
    }
  }

  /**
   * Handle window removed events
   */
  private handleWindowRemoved(windowId: number): void {
    if (windowId === this.currentWindowId) {
      // Current window was closed, try to get a new active window
      this.updateCurrentWindow()
    }
  }

  /**
   * Update current window by querying browser (fallback method)
   */
  private async updateCurrentWindow(): Promise<void> {
    try {
      const currentWindow = await browser.windows.getCurrent()
      this.currentWindowId = currentWindow.id || null
      logger.debug('Updated current window ID:', this.currentWindowId)
    }
    catch (error) {
      logger.warn('Failed to update current window:', error)
      this.currentWindowId = null
    }
  }

  /**
   * Cleanup listeners on service shutdown
   */
  cleanup(): void {
    if (browser.windows.onFocusChanged.hasListener(this.handleWindowFocusChanged)) {
      browser.windows.onFocusChanged.removeListener(this.handleWindowFocusChanged)
    }
    if (browser.windows.onCreated.hasListener(this.handleWindowCreated)) {
      browser.windows.onCreated.removeListener(this.handleWindowCreated)
    }
    if (browser.windows.onRemoved.hasListener(this.handleWindowRemoved)) {
      browser.windows.onRemoved.removeListener(this.handleWindowRemoved)
    }
    this.initialized = false
    logger.debug('Window Manager service cleaned up')
  }
}

export const BackgroundWindowManager = new WindowManagerService()
