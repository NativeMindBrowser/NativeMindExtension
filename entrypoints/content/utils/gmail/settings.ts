import { getUserConfig } from '@/utils/user-config'

export class GmailSettingsManager {
  private userConfig: Awaited<ReturnType<typeof getUserConfig>> | null = null

  async init() {
    if (!this.userConfig) {
      this.userConfig = await getUserConfig()
    }
  }

  async isEmailToolsEnabled(): Promise<boolean> {
    await this.init()
    return this.userConfig!.emailTools.enable.toRef().value === true
  }

  async getOutputLanguage(): Promise<string> {
    await this.init()
    return this.userConfig!.emailTools.outputLanguage.toRef().value
  }

  async getOutputStyle(): Promise<string> {
    await this.init()
    return this.userConfig!.emailTools.outputStyle.toRef().value
  }

  async getSummaryPrompt(): Promise<string> {
    await this.init()
    return this.userConfig!.emailTools.summary.systemPrompt.toRef().value
  }

  async getReplyPrompt(): Promise<string> {
    await this.init()
    return this.userConfig!.emailTools.reply.systemPrompt.toRef().value
  }

  async getComposePrompt(): Promise<string> {
    await this.init()
    return this.userConfig!.emailTools.compose.systemPrompt.toRef().value
  }
}
