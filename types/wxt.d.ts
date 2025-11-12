declare module 'wxt/browser' {
  namespace Browser {
    // this namespace is for Opera, Firefox
    export namespace sidebarAction {
      export const setPanel: (options: { panel: string }) => Promise<void>
      export const open: () => Promise<void>
      export const close: () => Promise<void>
      export const isOpen: (options?: object) => Promise<boolean>
      export const setTitle: (options: { title: string }) => Promise<void>
      export const getTitle: () => Promise<string>
      export const toggle: () => Promise<void>
    }

    export namespace runtime {
      export interface ManifestBase {
        sidebar_action?: {
          default_icon?: Record<number, string>
          default_title?: string
          default_panel?: string
          open_at_install?: boolean
        }
      }
    }

    // this namespace is only for Firefox, as Chrome uses the `browser.contextMenus`
    export namespace menus {
      export type OnShownInfo = {
        menuIds: string[]
        contexts: browser.Menus.ContextType[]
        viewType: 'tab'
        frameId: number
        editable: boolean
        targetElementId: number
        pageUrl: string
        selectionText?: string
      }

      export type CreateProperties = {
        id?: string
        title?: string
        contexts?: browser.Menus.ContextType[]
        type?: browser.Menus.ItemType
        checked?: boolean
        enabled?: boolean
        visible?: boolean
        documentUrlPatterns?: string[]
        targetUrlPatterns?: string[]
        onclick?: (info: OnShownInfo, tab?: browser.Tabs.Tab) => void
      }

      export type UpdateProperties = Omit<CreateProperties, 'id'>

      type Callback = () => void

      type AddEventListener = (callback: (info: OnShownInfo, tab?: Browser.tabs.Tab) => void) => void
      type UpdateMenuItem = (menuId: string, updateProperties: UpdateProperties) => Promise<void>

      export const onShown: {
        addListener: AddEventListener
      }

      export const create: (createProperties: CreateProperties, cb: Callback) => void
      export const update: (menuId: string, updateProperties: UpdateProperties, cb: Callback) => void
      export const refresh: () => Promise<void>
    }
  }
}

export {}
