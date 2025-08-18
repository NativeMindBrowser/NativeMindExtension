import { css, html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

import { iconMap, IconName } from '@/utils/icon'

export function register() {
  @customElement('nm-icon')
  class NMIcon extends LitElement {
    static properties = {
      name: { type: String },
      color: { type: String },
      size: { type: String },
    }

    static styles? = css`
      :host {
        color: var(--icon-color, black);
      }
      :host svg {
        width: var(--icon-size, 16px);
        height: var(--icon-size, 16px);
      }
      :host div {
        width: var(--icon-size, 16px);
        height: var(--icon-size, 16px);
      }
    `

    // Declare reactive properties
    @property()
    name?: IconName

    @property({ type: String })
    color?: string

    @property({ type: String })
    size?: string

    protected render() {
      this.style.setProperty('--icon-color', this.color || 'black')
      this.style.setProperty('--icon-size', this.size || '16px')

      if (!this.name || !(this.name in iconMap)) return html`<div></div>`
      return html`
        <div>
        ${unsafeHTML(iconMap[this.name])}
        </div>
      `
    }
  }
  return NMIcon
}
