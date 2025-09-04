import { LLMAdditionalInfo, LLMInfo, LLMInstanceAdditionalInfo, ModelInstanceInfoBase } from '@lmstudio/sdk'

export type LMStudioModelInfo = LLMInfo & { instances?: (ModelInstanceInfoBase & LLMAdditionalInfo & LLMInstanceAdditionalInfo)[] }
