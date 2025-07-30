import { Browser, browser } from 'wxt/browser'

function findDisplayForPoint(displays: Browser.system.display.DisplayUnitInfo[], point: { left: number, top: number }) {
  return displays.find((d) => {
    const b = d.bounds
    return point.left >= b.left
      && point.left < b.left + b.width
      && point.top >= b.top
      && point.top < b.top + b.height
  }) || displays.find((d) => d.isPrimary) || displays[0]
}

export async function getCurrentDisplayInfo() {
  const currentWindow = await browser.windows.getCurrent({ populate: false })
  const { left = 0, top = 0, width = 0, height = 0 } = currentWindow
  const displays = await browser.system.display.getInfo()
  const currentPoint = {
    left: left + Math.round(width / 2),
    top: top + Math.round(height / 2),
  }
  const display = findDisplayForPoint(displays, currentPoint)
  return display
}
