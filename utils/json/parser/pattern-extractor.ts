export function extractValueOfKeyByPattern(json: string, key: string): string | null {
  const regex = new RegExp(`"${key}"\\s*:\\s*("(.*?)"|\\d+|true|false|null)`, 'is')

  const match = json.match(regex)
  if (match && match[1]) {
    let value = match[1].trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
      const unescapedValue = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n')
      return unescapedValue
    }
    return value
  }
  return null
}
