// this file defines some constant texts used in the chat

import type { ComposerTranslation } from '@/utils/i18n'

import { makeContainer, makeParagraph } from '../markdown/content'

export const welcomeMessage = (t: ComposerTranslation) => {
  return `
${makeParagraph(t('onboarding.welcome_msg.title'), { class: 'text-base font-normal' })}

${makeContainer(t('onboarding.welcome_msg.body'), { class: 'text-xs text-[#596066]' })}
`.trim()
}
