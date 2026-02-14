import { browser } from 'wxt/browser'

import logger from './logger'
import { memoFunction } from './memo'

export function convertPropertiesIntoSimpleVariables(sheet: CSSStyleSheet, scopeInShadowDom = true) {
  const properties = []
  for (const rule of sheet.cssRules) {
    if (rule instanceof CSSPropertyRule) {
      if (rule.initialValue) {
        properties.push(`${rule.name}: ${rule.initialValue}`)
      }
    }
  }
  const scope = scopeInShadowDom ? ':host' : ':root'
  sheet.insertRule(`${scope} { ${properties.join('; ')} }`)
  return sheet
}

export function scopeStyleIntoShadowRoot(cssText: string) {
  const sheet = createStyleSheetByCssText(cssText.replaceAll(':root', ':host'))
  return sheet
}

async function loadContentScriptCss(name: string): Promise<string> {
  // @ts-expect-error - css output files is not defined in the types
  const url = browser.runtime.getURL(`/content-scripts/${name}.css`)
  try {
    const res = await fetch(url)
    return await res.text()
  }
  catch (err) {
    logger.warn(
      `Failed to load styles @ ${url}. Did you forget to import the stylesheet in your entrypoint?`,
      err,
    )
    return ''
  }
}

export const loadContentScriptStyleSheet = memoFunction(async (name: string): Promise<CSSStyleSheet> => {
  const contentScriptCss = await loadContentScriptCss(name)
  const styleSheet = convertPropertiesIntoSimpleVariables(scopeStyleIntoShadowRoot(contentScriptCss), true)
  return styleSheet
})

export function convertStyleSheetToCssText(sheet: CSSStyleSheet) {
  let cssText = ''
  for (const rule of sheet.cssRules) {
    cssText += rule.cssText + '\n'
  }
  return cssText
}

export function createStyleSheetByCssText(cssText: string) {
  const sheet = new CSSStyleSheet()
  try {
    sheet.replaceSync(cssText)
  }
  catch (err) {
    logger.error('Failed to create stylesheet from css text', err)
  }
  return sheet
}

export function replaceFontFaceUrl(sheet: CSSStyleSheet, converter: (url: string) => string) {
  let cssText = ''
  for (const rule of sheet.cssRules) {
    if (rule instanceof CSSFontFaceRule) {
      cssText += rule.cssText.replace(/url\(['"]?([^'")]+)['"]?\)/g, (_match, url) => {
        return `url('${converter(url)}')`
      }) + '\n'
    }
    else {
      cssText += rule.cssText + '\n'
    }
  }
  return createStyleSheetByCssText(cssText)
}

export function extractFontFace(sheet: CSSStyleSheet) {
  const fontFaces: string[] = []
  for (const rule of sheet.cssRules) {
    if (rule instanceof CSSFontFaceRule) {
      fontFaces.push(rule.cssText)
    }
  }
  const cssText = fontFaces.join('\n')
  const newSheet = new CSSStyleSheet()
  try {
    newSheet.replaceSync(cssText)
  }
  catch (err) {
    logger.error('Failed to extract font-face from stylesheet', err)
  }
  return newSheet
}

export function injectStyleSheetToDocument(doc: ShadowRoot | Document, sheet: CSSStyleSheet) {
  if (import.meta.env.FIREFOX) {
    // Firefox does not support adoptedStyleSheets before document loaded
    // so we need to inject the styles directly into the document
    const cssText = convertStyleSheetToCssText(sheet)
    const styleElement = document.createElement('style')
    styleElement.textContent = cssText
    if (doc instanceof ShadowRoot) {
      doc.appendChild(styleElement)
    }
    else {
      doc.head.appendChild(styleElement)
    }
    return () => {
      if (styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement)
      }
    }
  }
  else {
    if (doc.adoptedStyleSheets.includes(sheet)) {
      logger.warn('StyleSheet is already adopted in the document', sheet)
      return () => {}
    }
    doc.adoptedStyleSheets.push(sheet)
    return () => {
      const index = doc.adoptedStyleSheets.indexOf(sheet)
      if (index !== -1) {
        doc.adoptedStyleSheets.splice(index, 1)
      }
    }
  }
}
