import { css, html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

import IconLinkJump from '@/assets/icons/link-jump-arrow.svg?raw'
import { iconMap, IconName } from '@/utils/icon'

export function register() {
  @customElement('nm-agent-task')
  class NMAgentTask extends LitElement {
    static get properties() {
      return {
        type: { type: String },
        content: { type: String, attribute: 'data-content' },
        url: { type: String, attribute: 'data-url' },
      }
    }

    static styles = css`
      :host {
      }

      .task-root{
        display: flex;
        flex-direction: row;
        align-items: center;
        text-size: 14px;
        line-height: 20px;
        gap: 6px;
      }

      .task-action{
        color: var(--color-text-secondary, #596066);
        white-space: nowrap;
      }

      .task-content-wrapper{
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px 6px;
        background: var(--color-bg-clickable, #ffffff);
        border-radius: 4px;
        flex: 1;
        overflow: hidden;
        gap: 4px;
      }

      a.task-content-wrapper{
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px 6px;
        background: var(--color-bg-primary, #ffffff);
        border-radius: 4px;
        flex: 1;
        overflow: hidden;
        gap: 4px;
        cursor: pointer;
        color: var(--color-accent-primary, #24B960);
        text-decoration: none;
        white-space: nowrap;
      }

      .task-icon {
        align-items: center;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .task-content {
        display: flex;
        flex-direction: row;
        overflow: hidden;
        flex: 1;
        text-overflow: ellipsis;
      }

      .task-filename{
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-extension{
        flex-shrink: 0;
        display: flex;
        align-items: center;
      }
    `

    @property({ type: String })
    type?: 'search' | 'page' | 'tab' | 'pdf' | 'image'

    @property({ type: String })
    content?: string

    @property({ type: String })
    url?: string

    private getIconForType(type: string) {
      const iconMappings = {
        search: 'web',
        page: 'taskFetchPage',
        tab: 'link',
        pdf: 'pdf',
        image: 'taskReadFile',
      }

      const iconName = iconMappings[type as keyof typeof iconMappings] as IconName
      return iconMap[iconName] || ''
    }

    protected render() {
      const icon = this.type ? this.getIconForType(this.type) : ''

      if (this.type === 'pdf' && this.content) {
        // split filename into Part A & Part B by last 12 characters
        const partA = this.content.slice(0, -12)
        const partB = this.content.slice(-12)

        return html`
        <div class="task-root" style="color: var(--color-text-quaternary, #9EA3A8);">
          <div class="task-action">
            <slot></slot>
          </div>
          <div class="task-content-wrapper" title=${this.content}> 
            <span class="task-icon">${unsafeHTML(icon)}</span>
            <div class="task-content">
              <span class="task-filename">${partA}</span>
              <span class="file-extension">${partB}</span>
            </div>
          </div>
        </div>
        `
      }

      if (this.type === 'tab' && this.content) {
        return html`
          <div class="task-root" style="color: var(--color-text-quaternary, #9EA3A8);">
            <div class="task-action">
              <slot></slot>
            </div>
            <div class="task-content-wrapper" title=${this.content}>
              <div class="task-content">
                <span class="task-filename">${this.content}</span>
              </div>
            </div>
          </div>
        `
      }

      if (this.type === 'page') {
        return html`
          <div class="task-root" style="color: var(--color-accent-primary, #24B960);">
            <div class="task-action">
              <slot></slot>
            </div>
            <a class="task-content-wrapper" href="${this.url}" target="_blank" title=${this.content}> 
              <span class="task-icon">${unsafeHTML(icon)}</span>
              <div class="task-content">
                <span class="task-filename">${this.content}</span>
              <span class="file-extension">${unsafeHTML(IconLinkJump)}</span>
              </div>
            </a>
          </div>
        `
      }

      return html`
        <div class="task-root" style="color: var(--color-text-secondary, #596066);">
          <div class="task-action">
            <slot></slot>
          </div>
        </div>
        `
    }
  }
  return NMAgentTask
}
