import { APP_METADATA_META_TAG_NAME } from './constants'
import logger from './logger'

export function getAppMetadata() {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector(`meta[name="${APP_METADATA_META_TAG_NAME}"]`)
    if (meta) {
      return JSON.parse(meta.getAttribute('content')!) as AppMetadata
    }
  }
  if (typeof APP_METADATA !== 'undefined') {
    return APP_METADATA
  }
  throw new Error('APP_METADATA is not defined')
}

logger.debug('APP METADATA', getAppMetadata())
