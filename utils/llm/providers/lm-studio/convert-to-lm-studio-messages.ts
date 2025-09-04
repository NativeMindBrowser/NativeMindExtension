import { LanguageModelV1Prompt, UnsupportedFunctionalityError } from '@ai-sdk/provider'
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils'
import { ChatMessageInput, LMStudioClient } from '@lmstudio/sdk'

export async function convertToLMStudioMessages(client: LMStudioClient, prompt: LanguageModelV1Prompt): Promise<ChatMessageInput[]> {
  const messages: ChatMessageInput[] = []
  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content })
        break
      }

      case 'user': {
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text })
          break
        }

        const images = await Promise.all(content.filter((part) => part.type === 'image').map(async (part) => {
          if (part.image instanceof URL) {
            throw new UnsupportedFunctionalityError({
              functionality: 'Image URLs in user messages',
            })
          }
          return await client.files.prepareImageBase64('image.png', convertUint8ArrayToBase64(part.image))
        }))

        messages.push({
          role: 'user',
          content: content.filter((part) => part.type === 'text').map((part) => part.text).join(''),
          images: images.length > 0 ? images : undefined,
        })

        break
      }

      case 'assistant': {
        messages.push({
          role: 'assistant',
          content: content.filter((part) => part.type === 'text').map((part) => part.text).join(''),
        })

        break
      }

      case 'tool': {
        break
      }

      default: {
        const _exhaustiveCheck: never = role
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`)
      }
    }
  }

  return messages
}
