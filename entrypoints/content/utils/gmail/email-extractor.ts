import logger from '@/utils/logger'

export interface EmailData {
  from: string
  date: string
  to: string[]
  cc: string[]
  subject: string
  body: string
  attachments?: { filename: string, size: string }[]
}

export interface ThreadData {
  subject: string
  emails: EmailData[]
}

/**
 * Utility class for extracting email content from Gmail's DOM structure
 * Based on Gmail's current DOM selectors (may need updates as Gmail evolves)
 */
export class EmailExtractor {
  private log = logger.child('email-extractor')

  private querySelectorSafe<T extends Element>(parent: Document | Element, selector: string): T | null {
    try {
      return parent.querySelector<T>(selector)
    }
    catch (error) {
      this.log.warn('Failed to query selector:', selector, error)
      return null
    }
  }

  private querySelectorSafeAll<T extends Element>(parent: Document | Element, selector: string): T[] {
    try {
      return Array.from(parent.querySelectorAll<T>(selector))
    }
    catch (error) {
      this.log.warn('Failed to query selector all:', selector, error)
      return []
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Extract email content from Gmail's DOM
   * Based on the extraction logic from mapify-ext
   */
  async extractEmailContent(threadElement: HTMLElement): Promise<{ subject: string, emails: EmailData[] }> {
    try {
      const document = window.document

      // Extract subject
      const subject = this.querySelectorSafe<HTMLElement>(document, '[jsname="r4nke"]')?.innerText
        || this.querySelectorSafe<HTMLElement>(threadElement, 'h2')?.innerText
        || 'No Subject'

      // Expand all emails in the thread
      this.querySelectorSafe<HTMLElement>(document, '.adx')?.click()
      const nodeList = this.querySelectorSafeAll<HTMLElement>(threadElement, '.G3')
      const emails: EmailData[] = []

      if (!nodeList.length) {
        // Fallback: extract visible content if no individual emails found
        const bodyContent = this.querySelectorSafe<HTMLElement>(threadElement, '.a3s')?.innerText
          || threadElement.innerText || ''
        return { subject, emails: [{ from: '', date: '', to: [], cc: [], subject, body: bodyContent }] }
      }

      for (const htmlItem of nodeList) {
        // Click to expand email details
        const expandTr = this.querySelectorSafe<HTMLElement>(htmlItem, 'tr')
        expandTr?.click() // first click for expand dom
        expandTr?.click() // second click for close dom
        await this.sleep(10)

        // Get email details panel
        const trigger = this.querySelectorSafe<HTMLElement>(htmlItem, '.ajz')
        trigger?.click()

        const panel = this.querySelectorSafe<HTMLElement>(htmlItem, '.ajA')
        const header = this.querySelectorSafe<HTMLElement>(htmlItem, '.iv')

        if (!header) continue

        // Extract email metadata
        const from = this.querySelectorSafe<HTMLElement>(header, '.qu')?.innerText || ''
        const date = this.querySelectorSafe<HTMLElement>(header, '.g3')?.innerText || ''
        const body = this.querySelectorSafe<HTMLElement>(htmlItem, '.a3s')?.innerText || ''

        // Extract attachments
        const attachments: { filename: string, size: string }[] = []
        const attachContainer = this.querySelectorSafe<HTMLElement>(htmlItem, '.aQH')
        if (attachContainer) {
          const attachList = this.querySelectorSafeAll<HTMLElement>(attachContainer, '.aZo')
          for (const attach of attachList) {
            const filename = this.querySelectorSafe<HTMLElement>(attach, '.aV3')?.innerText || ''
            const size = this.querySelectorSafe<HTMLElement>(attach, '.SaH2Ve')?.innerText || ''
            if (filename) attachments.push({ filename, size })
          }
        }

        // Hide details panel
        if (panel) {
          panel.style.display = 'none'
          panel.style.visibility = 'hidden'
        }

        // Extract recipient details
        const detailDom = this.querySelectorSafe(htmlItem, '.ajA')
        const detailsDoms: HTMLElement[] = []
        if (detailDom) {
          const detailDomList = this.querySelectorSafeAll(detailDom, 'tr')
          detailDomList.forEach((dom) => {
            const emailElement = this.querySelectorSafe(dom, '[email]')
            if (emailElement) {
              detailsDoms.push(emailElement as HTMLElement)
            }
          })
        }

        // Parse recipient information
        const emailInfo = detailsDoms?.map((dom: HTMLElement) => {
          const input = dom.parentElement?.innerText || ''
          const regex = /([^<,>]+)\s*<([^<,>]+)>/g
          const emailAddresses = []
          let result
          while ((result = regex.exec(input)) !== null) {
            emailAddresses.push(result[0])
          }
          return emailAddresses
        })

        const index = detailsDoms.length >= 3 ? 2 : 1
        emails.push({
          from,
          date,
          to: emailInfo[index] || [],
          cc: emailInfo[index + 1] || [],
          subject,
          body,
          attachments: attachments.length > 0 ? attachments : undefined,
        })
      }

      // Format the extracted content
      return {
        subject,
        emails,
      }
    }
    catch (error) {
      this.log.error('Failed to extract email thread content:', error)
      // Fallback to simple text extraction
      return {
        subject: 'Failed to extract subject',
        emails: [{
          from: '',
          date: '',
          to: [],
          cc: [],
          subject: '',
          body: threadElement.innerText || 'Failed to extract email content',
        }],
      }
    }
  }

  /**
   * Format thread data into readable string
   */
  formatThreadContent(threadData: ThreadData): string {
    let content = `Subject: ${threadData.subject}\n\n`

    threadData.emails.forEach((email, index) => {
      content += `--- Email ${index + 1} ---\n`
      content += `From: ${email.from}\n`
      content += `Date: ${email.date}\n`
      if (email.to?.length) content += `To: ${email.to.join(', ')}\n`
      if (email.cc?.length) content += `CC: ${email.cc.join(', ')}\n`
      if (email.attachments?.length) {
        content += `Attachments: ${email.attachments.map((a) => `${a.filename} (${a.size})`).join(', ')}\n`
      }
      content += `\n${email.body}\n\n`
    })

    return content
  }

  /**
   * Extract draft content from compose area
   */
  extractDraftContent(composeElement: HTMLElement): string {
    const draftBody = this.querySelectorSafe<HTMLElement>(composeElement, '[contenteditable="true"]')
    return draftBody?.innerText || ''
  }

  /**
   * Extract recipients from compose area
   */
  extractRecipients(composeElement: HTMLElement): { to: string[], cc: string[], bcc: string[] } {
    const extractRecipientsFromListbox = (listbox: HTMLElement): string[] => {
      const recipients: string[] = []
      const options = this.querySelectorSafeAll<HTMLElement>(listbox, '[role="option"][data-hovercard-id]')

      for (const option of options) {
        const email = option.getAttribute('data-hovercard-id') || ''
        const name = option.getAttribute('data-name') || ''

        if (email) {
          if (name && name !== email) {
            recipients.push(`${name} <${email}>`)
          }
          else {
            recipients.push(email)
          }
        }
      }

      return recipients
    }

    // Use specific selectors for each recipient type within the compose dialog
    const toListboxes = this.querySelectorSafeAll<HTMLElement>(composeElement, '[aria-label="To"] [role="listbox"]')
    const ccListboxes = this.querySelectorSafeAll<HTMLElement>(composeElement, '[aria-label="Cc"] [role="listbox"]')
    const bccListboxes = this.querySelectorSafeAll<HTMLElement>(composeElement, '[aria-label="Bcc"] [role="listbox"]')

    // Extract recipients from each type of listbox
    const toRecipients: string[] = []
    const ccRecipients: string[] = []
    const bccRecipients: string[] = []

    // Extract TO recipients
    for (const listbox of toListboxes) {
      toRecipients.push(...extractRecipientsFromListbox(listbox))
    }

    // Extract CC recipients
    for (const listbox of ccListboxes) {
      ccRecipients.push(...extractRecipientsFromListbox(listbox))
    }

    // Extract BCC recipients
    for (const listbox of bccListboxes) {
      bccRecipients.push(...extractRecipientsFromListbox(listbox))
    }

    return {
      to: toRecipients,
      cc: ccRecipients,
      bcc: bccRecipients,
    }
  }

  /**
   * Extract subject from compose area
   */
  extractSubject(composeElement: HTMLElement): string {
    const subjectField = this.querySelectorSafe<HTMLInputElement>(composeElement, 'input[name="subjectbox"]')
    return subjectField?.value || ''
  }
}
