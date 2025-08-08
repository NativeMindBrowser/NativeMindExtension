import { beforeAll, describe, expect, it, vi } from 'vitest'

import { resetFakeEntrypoint } from '@/tests/utils/fake-browser'
import { ContextAttachmentStorage } from '@/types/chat'

import dayjs from '../time'
import { EnvironmentDetailsBuilder } from './chat'

describe('prompt builder', () => {
  beforeAll(() => {
    resetFakeEntrypoint()
  })

  it('should build a proper prompt', async () => {
    const fakeDate = new Date('2025-08-07T16:20:31+08:00')
    vi.setSystemTime(fakeDate)

    const contextAttachmentStorage: ContextAttachmentStorage = {
      id: 'test-id',
      attachments: [],
      currentTab: undefined,
    }
    const environmentDetailsBuilder = new EnvironmentDetailsBuilder(contextAttachmentStorage)
    const envDetails = environmentDetailsBuilder.generateFull()
    expect(envDetails).toBe(`<environment_details>
# Current Time
${dayjs().format('YYYY-MM-DD HH:mm:ss Z[Z]')}
# Available Tabs
(No open tabs)
# Available PDFs
(No available PDFs)
# Available Images
(No available images)
</environment_details>`)

    contextAttachmentStorage.currentTab = {
      type: 'tab',
      value: {
        id: 'test-tab',
        title: 'Test Tab',
        url: 'https://example.com',
        tabId: 1,
        windowId: 1,
      },
    }

    let updateInfo = environmentDetailsBuilder.generateUpdates([])
    expect(updateInfo).toBe(`<environment_updates>
# Updated Tabs
- Tab ID test-tab (SELECTED): "Test Tab"
</environment_updates>`)

    contextAttachmentStorage.attachments.push({
      type: 'image',
      value: {
        id: 'image-1',
        name: 'Image 1',
        size: 12345,
        data: 'base64-image-data',
        type: 'image/png',
      },
    })

    updateInfo = environmentDetailsBuilder.generateUpdates(['test-tab'])
    expect(updateInfo).toBe(`<environment_updates>
# Updated Images
- Image ID image-1: Image 1
</environment_updates>`)

    contextAttachmentStorage.attachments[0].value = {
      ...contextAttachmentStorage.attachments[0].value,
      name: 'Updated Image 1',
      id: 'updated-image-1',
    }

    updateInfo = environmentDetailsBuilder.generateUpdates(['test-tab', 'image-1'])
    expect(updateInfo).toBe(`<environment_updates>
# Updated Images
- Image ID updated-image-1: Updated Image 1
</environment_updates>`)

    // do nothing if something is deleted
    contextAttachmentStorage.attachments.length = 0
    updateInfo = environmentDetailsBuilder.generateUpdates(['test-tab', 'image-1', 'updated-image-1'])
    expect(updateInfo).toBe(undefined)
  })
})
