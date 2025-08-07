const LEVELS = ['debug', 'info', 'warn', 'error'] as const
type Level = (typeof LEVELS)[number]

class Logger {
  private static levels: Level[] = LEVELS.slice()
  static setLevels(levels: Level[]): void {
    Logger.levels = levels
  }

  private shouldLog(level: Level) {
    return Logger.levels.includes(level)
  }

  moduleList: string[] = []
  constructor(modules?: string[]) {
    if (modules) {
      this.moduleList.push(...modules)
    }
  }

  private prefix() {
    let prefix = '[NativeMind] '
    if (this.moduleList.length > 0) {
      prefix += ` [${this.moduleList.join('][')}]`
    }
    return prefix
  }

  child(module: string): Logger {
    const logger = new Logger([...this.moduleList, module])
    return logger
  }

  debug(...messages: any[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(`${this.prefix()}`, ...messages)
    }
  }

  error(...messages: any[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.error(`${this.prefix()}`, ...messages)
    }
  }

  warn(...messages: any[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.warn(`${this.prefix()}`, ...messages)
    }
  }

  info(...messages: any[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(`${this.prefix()}`, ...messages)
    }
  }

  table(...messages: any[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.table(...messages)
    }
  }
}

Logger.setLevels(import.meta.env.PROD ? [] : LEVELS.slice())

export const logger = new Logger()
export default logger

if (typeof self !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).__NATIVEMIND_LOGGER__ = Logger
}
