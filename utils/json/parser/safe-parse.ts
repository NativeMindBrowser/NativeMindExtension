import Logger from '@/utils/logger'

const logger = Logger.child('safe-parse-json')

export function safeParseJSON<T>(input?: string | null) {
  if (!input) return null
  try {
    return JSON.parse(input) as T
  }
  catch (error) {
    logger.debug('Failed to parse JSON:', error, input)
    return null
  }
}
