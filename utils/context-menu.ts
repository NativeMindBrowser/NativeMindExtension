import { Browser, browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'

import { ContextType } from '@/types/browser'

import { nonNullable } from './array'
import { CONTEXT_MENU_STORAGE_KEY } from './constants'
import { ComposerTranslation, TranslationKey, useGlobalI18n } from './i18n'
import logger from './logger'
import { only } from './runtime'
import { ArrayNonEmpty } from './type-utils'

const log = logger.child('context-menu')

export type ContextMenuId = 'native-mind-page-translate' | 'native-mind-selection-translate' | 'native-mind-settings' | 'native-mind-quick-actions' | `native-mind-quick-actions-${number}` | 'native-mind-root-menu' | 'native-mind-add-image-to-chat'
export type ContextTypeList = ArrayNonEmpty<Browser.contextMenus.ContextType>

export type ContextMenuItem = {
  id: ContextMenuId
  titleKey: TranslationKey
  contexts: ContextTypeList
}

export const CONTEXT_MENU_ITEM_TRANSLATE_SELECTED_TEXT: ContextMenuItem = {
  id: 'native-mind-selection-translate',
  titleKey: 'context_menu.translation.translate_selected_text',
  contexts: [ContextType.SELECTION],
}

export const CONTEXT_MENU_ITEM_TRANSLATE_PAGE: ContextMenuItem = {
  id: 'native-mind-page-translate',
  titleKey: 'context_menu.translation.translate_page_into',
  contexts: [ContextType.PAGE, ContextType.SELECTION, ContextType.LINK, ContextType.IMAGE, ContextType.AUDIO, ContextType.VIDEO, ContextType.FRAME],
}

export const CONTEXT_MENU_ITEM_SETTINGS: ContextMenuItem = {
  id: 'native-mind-settings',
  titleKey: 'context_menu.settings.title',
  contexts: [ContextType?.ACTION],
}

export const CONTEXT_MENU_ITEM_ADD_IMAGE_TO_CHAT: ContextMenuItem = {
  id: 'native-mind-add-image-to-chat',
  titleKey: 'context_menu.add_image.title',
  contexts: [ContextType?.IMAGE],
}

export const CONTEXT_MENU: ContextMenuItem[] = [
  CONTEXT_MENU_ITEM_TRANSLATE_PAGE,
  CONTEXT_MENU_ITEM_TRANSLATE_SELECTED_TEXT,
  CONTEXT_MENU_ITEM_ADD_IMAGE_TO_CHAT,
  CONTEXT_MENU_ITEM_SETTINGS,
]

export type ContextMenu = typeof CONTEXT_MENU

export type ExtraCreateProperties = {
  needOpenSidepanel?: boolean
  titleKey?: TranslationKey
}

type ContextMenuMapItem = {
  id: ContextMenuId | undefined // undefined for root menu
  title?: string
  titleKey?: TranslationKey
  contexts?: ContextTypeList
  visible: boolean
  parentId?: ContextMenuId
  needOpenSidepanel?: boolean
  children: ContextMenuId[]
}

class PrivateContextMenuManager {
  private static instance: PrivateContextMenuManager | null = null
  private reconstructing = false
  private pendingReconstruct = false
  private constructor(private t: ComposerTranslation) {}

  static async getInstance() {
    if (!ContextMenuManager.instance) {
      ContextMenuManager.instance = new ContextMenuManager((await useGlobalI18n()).t)
      await ContextMenuManager.instance.restoreCurrentMenuMap()
    }
    return ContextMenuManager.instance
  }

  currentMenuMap = new Map<ContextMenuId | undefined, ContextMenuMapItem>()

  private saveCurrentMenuMap() {
    return storage.setItem(CONTEXT_MENU_STORAGE_KEY, [...this.currentMenuMap.entries()])
  }

  private createMenuItem(params: Browser.contextMenus.CreateProperties) {
    return new Promise<void>((resolve, reject) => {
      browser.contextMenus.create(params, () => {
        if (browser.runtime.lastError) {
          log.error('Failed to create root context menu:', browser.runtime.lastError)
          reject(browser.runtime.lastError)
        }
        else {
          resolve()
        }
      })
    })
  }

  private async restoreCurrentMenuMap() {
    const storedMap = await storage.getItem<[ContextMenuId | undefined, ContextMenuMapItem][]>(CONTEXT_MENU_STORAGE_KEY)
    if (storedMap) {
      this.currentMenuMap = new Map<ContextMenuId | undefined, ContextMenuMapItem>(storedMap.map(([id, item]) => [id ?? undefined, item]))
      log.debug('Restored context menu map from storage', structuredClone(this.currentMenuMap))
    }
    else {
      log.debug('No stored context menu map found, starting with an empty map')
    }
  }

  private async reconstructContextMenu() {
    if (this.reconstructing) {
      this.pendingReconstruct = true
      log.debug('Context menu is being reconstructed, pending...')
      return
    }
    this.reconstructing = true
    await this.saveCurrentMenuMap()
    try {
      log.debug('Reconstructing context menu', this.currentMenuMap)
      await browser.contextMenus.removeAll()
      const firstLevelMenus = Array.from(this.currentMenuMap.values()).filter((item) => item.parentId === undefined)
      const reconstructMenuItem = async (parentId: string | undefined, items: ContextMenuMapItem[], titlePrefix?: string) => {
        for (const item of items) {
          await this.createMenuItem({
            id: item.id,
            title: `${titlePrefix || ''}${item.title ?? (item.titleKey ? this.t(item.titleKey) : '')}`,
            contexts: item.contexts,
            parentId,
            visible: item.visible,
          }).catch((error) => {
            log.error('Failed to create context menu item', item.id, error)
          })
          const children = item.children.map((childId) => this.currentMenuMap.get(childId)).filter(nonNullable)
          await reconstructMenuItem(item.id, children)
        }
      }

      await this.createMenuItem({
        id: 'native-mind-root-menu',
        title: 'NativeMind',
        contexts: [ContextType.ALL],
      }).catch((error) => {
        log.error('Failed to create root context menu:', error)
      })
      await reconstructMenuItem('native-mind-root-menu', firstLevelMenus)

      if (import.meta.env.FIREFOX) {
        await browser.menus.refresh()
      }
    }
    catch (error) {
      log.error('Error reconstructing context menu:', error)
    }
    finally {
      this.reconstructing = false
      if (this.pendingReconstruct) {
        this.pendingReconstruct = false
        await this.reconstructContextMenu()
      }
    }
  }

  async updateContextMenu(id: ContextMenuId, props: Omit<Browser.contextMenus.CreateProperties, 'id'> & ExtraCreateProperties) {
    if (!this.currentMenuMap.has(id)) {
      log.warn('Context menu with id does not exist, creating instead', id)
      await this.createContextMenu(id, props)
      return
    }
    const parentId = props.parentId as ContextMenuId | undefined
    const r = this.currentMenuMap.get(id)!
    const parent = this.currentMenuMap.get(parentId)
    if (r.parentId !== parentId) {
      const oldParentId = r.parentId
      const parentItem = this.currentMenuMap.get(parentId)
      const oldParentItem = this.currentMenuMap.get(oldParentId)
      if (parentItem) {
        parentItem.children.push(id)
      }
      if (oldParentItem) {
        oldParentItem.children = oldParentItem.children.filter((childId) => childId !== id)
      }
    }
    else if (parent && !parent.children.includes(id)) {
      parent.children.push(id)
    }
    r.parentId = (props.parentId ?? r.parentId) as ContextMenuId | undefined
    r.title = 'title' in props ? props.title : r.title
    r.titleKey = 'titleKey' in props ? props.titleKey : r.titleKey
    r.contexts = (props.contexts ?? r.contexts) as ContextTypeList
    r.visible = props.visible ?? true
    r.needOpenSidepanel = props.needOpenSidepanel ?? r.needOpenSidepanel
    log.debug('Updating context menu', id, props, structuredClone(this.currentMenuMap))
    await this.reconstructContextMenu()
  }

  async createContextMenu(id: ContextMenuId, props: Omit<Browser.contextMenus.CreateProperties, 'id'> & ExtraCreateProperties) {
    if (this.currentMenuMap.has(id)) {
      log.warn('Context menu with id already exists, updating instead', id)
      await this.updateContextMenu(id, props)
      return
    }
    const parentId = props.parentId as ContextMenuId | undefined
    const visible = props.visible ?? true
    const item: ContextMenuMapItem = {
      id,
      title: props.title,
      titleKey: props.titleKey,
      contexts: props.contexts as ContextTypeList,
      needOpenSidepanel: props.needOpenSidepanel,
      visible,
      parentId,
      children: [],
    }
    this.currentMenuMap.set(id, item)
    if (parentId) {
      const parentItem = this.currentMenuMap.get(parentId)
      if (!parentItem) {
        log.error('Parent context menu not found for', id, 'parentId:', parentId, structuredClone(this.currentMenuMap))
      }
      else {
        parentItem.children.push(id)
      }
    }
    log.debug('Creating context menu', id, props, structuredClone(this.currentMenuMap))
    await this.reconstructContextMenu()
  }

  private recursiveDeleteContextMenu(id: ContextMenuId, deleted = new Set<ContextMenuId>()) {
    if (deleted.has(id)) {
      log.error('Recursive deletion detected for context menu', id, structuredClone(this.currentMenuMap))
      return
    }
    const item = this.currentMenuMap.get(id)
    if (!item) return
    this.currentMenuMap.delete(id)
    deleted.add(id)
    if (item.children.length) {
      for (const childId of item.children) {
        this.recursiveDeleteContextMenu(childId)
      }
    }
  }

  async deleteContextMenu(id: ContextMenuId) {
    log.debug('Deleting context menu', id, structuredClone(this.currentMenuMap))
    const item = this.currentMenuMap.get(id)
    this.recursiveDeleteContextMenu(id)
    const parentItem = this.currentMenuMap.get(item?.parentId)
    if (parentItem) {
      parentItem.children = parentItem.children.filter((childId) => childId !== id)
    }
    log.debug('Deleting context menu finished', id, structuredClone(this.currentMenuMap))
    await this.reconstructContextMenu()
  }

  isNeedOpenSidepanel(id: ContextMenuId) {
    const item = this.currentMenuMap.get(id)
    return item?.needOpenSidepanel
  }
}

// for consistency reason, ContextMenuManager can only be used in background
export const ContextMenuManager = only(['background'], () => PrivateContextMenuManager)
export type ContextMenuManager = PrivateContextMenuManager
