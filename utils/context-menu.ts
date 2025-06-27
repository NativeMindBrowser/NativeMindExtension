import { Browser, browser } from 'wxt/browser'

import { nonNullable } from './array'
import logger from './logger'
import { Entrypoint, only } from './runtime'
import { ArrayNonEmpty } from './type-utils'

const log = logger.child('context-menu')

export type ContextMenuId = 'native-mind-page-translate' | 'native-mind-selection-translate' | 'native-mind-settings' | 'native-mind-quick-actions' | `native-mind-quick-actions-${number}` | 'native-mind-root-menu'
export type ContextTypeList = ArrayNonEmpty<Browser.contextMenus.ContextType>

export type ContextMenuItem = {
  id: ContextMenuId
  title: string
  contexts: ContextTypeList
}

const ContextType = only([Entrypoint.background], () => browser.contextMenus.ContextType)
export const CONTEXT_MENU_ITEM_TRANSLATE_SELECTED_TEXT: ContextMenuItem = only([Entrypoint.background], () => ({
  id: 'native-mind-selection-translate',
  title: 'Translate selected text',
  contexts: [ContextType.SELECTION],
}))

export const CONTEXT_MENU_ITEM_TRANSLATE_PAGE: ContextMenuItem = only([Entrypoint.background], () => ({
  id: 'native-mind-page-translate',
  title: 'Translate this page',
  contexts: [ContextType.PAGE],
}))

export const CONTEXT_MENU_ITEM_SETTINGS: ContextMenuItem = only([Entrypoint.background], () => ({
  id: 'native-mind-settings',
  title: 'Settings',
  contexts: [ContextType?.ACTION],
}))

export const CONTEXT_MENU: ContextMenuItem[] = [
  CONTEXT_MENU_ITEM_TRANSLATE_PAGE,
  CONTEXT_MENU_ITEM_TRANSLATE_SELECTED_TEXT,
  CONTEXT_MENU_ITEM_SETTINGS,
]

export type ContextMenu = typeof CONTEXT_MENU

type ContextMenuMapItem = {
  id: ContextMenuId | undefined // undefined for root menu
  title?: string
  contexts?: ContextTypeList
  visible: boolean
  parentId?: ContextMenuId
  children: ContextMenuId[]
}

export class ContextMenuManager {
  private static instance: ContextMenuManager | null = null
  private reconstructing = false
  private pendingReconstruct = false
  private constructor() {}

  static getInstance() {
    if (!ContextMenuManager.instance) {
      ContextMenuManager.instance = new ContextMenuManager()
    }
    return ContextMenuManager.instance
  }

  currentMenuMap = new Map<ContextMenuId | undefined, ContextMenuMapItem>()

  private async reconstructContextMenu() {
    if (this.reconstructing) {
      this.pendingReconstruct = true
      log.debug('Context menu is being reconstructed, pending...')
      return
    }
    this.reconstructing = true
    try {
      log.debug('Reconstructing context menu', this.currentMenuMap)
      await browser.contextMenus.removeAll()
      const firstLevelMenus = Array.from(this.currentMenuMap.values()).filter((item) => item.parentId === undefined)
      const reconstructMenuItem = async (parentId: string | undefined, items: ContextMenuMapItem[], titlePrefix?: string) => {
        for (const item of items) {
          browser.contextMenus.create({
            id: item.id,
            title: `${titlePrefix || ''}${item.title}`,
            contexts: item.contexts,
            parentId,
            visible: item.visible,
          })
          const children = item.children.map((childId) => this.currentMenuMap.get(childId)).filter(nonNullable)
          await reconstructMenuItem(item.id, children)
        }
      }

      // context menu belongs to the same group can not display in the same level at the same time
      const contextTypeGroup: Record<ContextTypeList[0], number> = {
        [ContextType.ALL]: 0,
        [ContextType.PAGE]: 1,
        [ContextType.SELECTION]: 1,
        [ContextType.LINK]: 1,
        [ContextType.IMAGE]: 1,
        [ContextType.AUDIO]: 1,
        [ContextType.VIDEO]: 1,
        [ContextType.FRAME]: 1,
        [ContextType.BROWSER_ACTION]: 1,
        [ContextType.PAGE_ACTION]: 1,
        [ContextType.EDITABLE]: 1,
        [ContextType.ACTION]: 2,
        [ContextType.LAUNCHER]: 3,
      }
      const groups = new Set()
      for (const m of firstLevelMenus) {
        if (!m.visible) continue
        if (!m.contexts) {
          groups.add(contextTypeGroup[ContextType.SELECTION])
        }
        else {
          m.contexts.forEach((context) => {
            groups.add(contextTypeGroup[context])
          })
        }
      }
      groups.delete(contextTypeGroup[ContextType.ACTION])
      if (groups.size > 1) {
        browser.contextMenus.create({
          id: 'native-mind-root-menu',
          title: 'NativeMind',
          contexts: ['all'],
        })
        await reconstructMenuItem('native-mind-root-menu', firstLevelMenus)
      }
      else {
        await reconstructMenuItem(undefined, firstLevelMenus, 'NativeMind: ')
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

  async updateContextMenu(id: ContextMenuId, props: Omit<Browser.contextMenus.CreateProperties, 'id'>) {
    log.debug('Updating context menu', id, props)
    if (!this.currentMenuMap.has(id)) {
      log.warn('Context menu with id does not exist, creating instead', id)
      await this.createContextMenu(id, props)
      return
    }
    const parentId = props.parentId as ContextMenuId | undefined
    const r = this.currentMenuMap.get(id)!
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
    r.parentId = props.parentId as ContextMenuId | undefined
    r.title = props.title
    r.contexts = props.contexts as ContextTypeList
    r.visible = props.visible ?? true
    await this.reconstructContextMenu()
  }

  async createContextMenu(id: ContextMenuId, props: Omit<Browser.contextMenus.CreateProperties, 'id'>) {
    log.debug('Creating context menu', id, props)
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
      contexts: props.contexts as ContextTypeList,
      visible,
      parentId,
      children: [],
    }
    this.currentMenuMap.set(id, item)
    if (parentId) {
      const parentItem = this.currentMenuMap.get(parentId)
      if (parentItem) {
        parentItem.children.push(id)
      }
    }
    await this.reconstructContextMenu()
  }

  private recursiveDeleteContextMenu(id: ContextMenuId) {
    const item = this.currentMenuMap.get(id)
    if (!item) return
    this.currentMenuMap.delete(id)
    if (item.children.length) {
      for (const childId of item.children) {
        this.recursiveDeleteContextMenu(childId)
      }
    }
  }

  async deleteContextMenu(id: ContextMenuId) {
    const item = this.currentMenuMap.get(id)
    this.recursiveDeleteContextMenu(id)
    const parentItem = this.currentMenuMap.get(item?.parentId)
    if (parentItem) {
      parentItem.children = parentItem.children.filter((childId) => childId !== id)
    }
    await this.reconstructContextMenu()
  }
}
