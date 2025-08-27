export function extractFileNameFromUrl(url: string, fallback: string) {
  if (url.startsWith('data:')) {
    return fallback
  }
  return new URL(url, window.location.origin).pathname.split('/').pop() ?? fallback
}

type UrlParts = 'protocol' | 'origin' | 'hostname' | 'pathname' | 'search' | 'hash'
interface UrlCompareOptions {
  parts?: UrlParts[]
}

export function isUrlEqual(left: URL, right: URL, options: UrlCompareOptions) {
  const { parts } = options
  if (!parts || parts.length === 0) {
    return left.href === right.href
  }
  for (const part of parts) {
    if (left[part] !== right[part]) {
      return false
    }
  }
  return true
}
