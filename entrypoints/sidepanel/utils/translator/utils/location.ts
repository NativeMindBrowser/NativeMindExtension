export function getPageUrl() {
  return window.location.href
}

export function getPageHostName() {
  const url = getPageUrl()
  return new URL(url).hostname.replace(/^www\./, '')
}
