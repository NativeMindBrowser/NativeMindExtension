export function extractRawValueOfKeyByPattern(json: string, key: string): string | undefined {
  const regex = new RegExp(`"${key}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|\\d+|true|false|null)`, 'is')

  const match = json.match(regex)
  if (match && match[1]) {
    const value = match[1].trim()
    return value
  }
  return undefined
}

type JSONValue = string | number | boolean | null

export function extractValueOfKeyByPattern(json: string, key: string): JSONValue | undefined {
  const rawValue = extractRawValueOfKeyByPattern(json, key)
  if (rawValue === null) return null

  if (rawValue === 'true') return true
  if (rawValue === 'false') return false
  if (rawValue === 'null') return null
  if (!isNaN(Number(rawValue))) return Number(rawValue)
  if (rawValue && rawValue.startsWith('"') && rawValue.endsWith('"')) {
    const value = rawValue.slice(1, -1)
    const unescapedValue = value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
    return unescapedValue
  }
  return undefined
}
