import { mount, VueWrapper } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import { resetFakeEntrypoint } from '@/tests/utils/fake-browser'
import { sleep } from '@/utils/async'

async function waitForSelector<T extends VueWrapper, K extends (keyof HTMLElementTagNameMap)>(wrapper: T, selector: K, timeout?: number): Promise<VueWrapper<HTMLElementTagNameMap[K]>>
async function waitForSelector<T extends VueWrapper, K extends (keyof SVGElementTagNameMap)>(wrapper: T, selector: K, timeout?: number): Promise<VueWrapper<SVGElementTagNameMap[K]>>
async function waitForSelector<T extends VueWrapper, K extends string>(wrapper: T, selector: K, timeout?: number): Promise<VueWrapper<Element>>
async function waitForSelector<T extends VueWrapper, K extends string>(wrapper: T, selector: K, timeout = 5000): Promise<VueWrapper<Element>> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const el = wrapper.find(selector)
    if (el.exists()) {
      return el as unknown as VueWrapper<Element>
    }
    await sleep(100)
  }
  throw new Error(`Element with selector "${selector}" not found within ${timeout}ms`)
}

describe('MarkdownViewer', () => {
  beforeEach(() => {
    // See https://webext-core.aklinker1.io/fake-browser/reseting-state
    fakeBrowser.reset()
  })
  beforeAll(() => {
    resetFakeEntrypoint()
  })

  it('should render directive correctly (text)', async () => {
    const { makeText } = await import('@/entrypoints/sidepanel/utils/markdown/content')
    const MarkdownViewer = (await import('./MarkdownViewer.vue')).default
    const wrapper = mount(MarkdownViewer, {
      props: {
        text: `# Hello World ${makeText('BIG TEXT', { size: 50 })}`,
      },
    })

    const textEl = await waitForSelector(wrapper, 'span')
    expect(textEl.text()).toBe('BIG TEXT')
    expect(textEl.element.style.fontSize).toBe('50px')
  })

  it('should render directive correctly (icon)', async () => {
    const { makeMarkdownIcon } = await import('@/entrypoints/sidepanel/utils/markdown/content')
    const MarkdownViewer = (await import('./MarkdownViewer.vue')).default
    const wrapper = mount(MarkdownViewer, {
      props: {
        text: `Hello World ${makeMarkdownIcon('download')}`,
      },
    })

    const textEl = await waitForSelector(wrapper, 'path')
    expect(textEl.exists()).toBeTruthy()
  })

  it('should render directive correctly (paragraph)', async () => {
    const { makeParagraph } = await import('@/entrypoints/sidepanel/utils/markdown/content')
    const MarkdownViewer = (await import('./MarkdownViewer.vue')).default
    const wrapper = mount(MarkdownViewer, {
      props: {
        text: `Hello World 
${makeParagraph('download', { class: 'test-class' })}`,
      },
    })

    const pEl = await waitForSelector(wrapper, 'p.test-class')
    expect(pEl.exists()).toBeTruthy()
    expect(pEl.text()).toBe('download')
  })
})
