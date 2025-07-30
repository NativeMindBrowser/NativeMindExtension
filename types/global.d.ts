interface AppMetadata {
  entrypoint: 'content' | 'background' | 'mainWorldInjected' | 'popup' | 'sidepanel' | 'settings'
}

// eslint-disable-next-line no-var
declare var APP_METADATA: AppMetadata

interface globalTHis {
  APP_METADATA: AppMetadata
}

interface Screen {
  readonly availLeft: number // non-standard property, please use carefully
  readonly availTop: number
}
