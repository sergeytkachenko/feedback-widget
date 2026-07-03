import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { InternalEvents, emitInternal } from '../core/events.js';
import type { ModeDetail } from '../core/events.js';
import type { WidgetPosition } from '../types.js';

export class FwMenu extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      min-width: 232px;
      background: #ffffff;
      color: #1c2030;
      border-radius: 14px;
      box-shadow: 0 10px 34px rgba(15, 18, 24, 0.22);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    :host([placement^='bottom']) {
      bottom: calc(100% + 12px);
    }
    :host([placement^='top']) {
      top: calc(100% + 12px);
    }
    :host([placement$='right']) {
      right: 0;
    }
    :host([placement$='left']) {
      left: 0;
    }
    button {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      border: none;
      background: transparent;
      border-radius: 10px;
      padding: 10px 12px;
      font: 500 14px/1.2 system-ui, -apple-system, sans-serif;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }
    button:hover {
      background: rgba(15, 18, 24, 0.06);
    }
    svg {
      width: 18px;
      height: 18px;
      flex: none;
      color: var(--fw-accent, #6d5cff);
    }
    .mic {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px 6px;
      font: 400 12px/1.2 system-ui, -apple-system, sans-serif;
      color: #5a6072;
      cursor: pointer;
      border-top: 1px solid rgba(15, 18, 24, 0.08);
      margin-top: 4px;
    }
    .mic input {
      accent-color: var(--fw-accent, #6d5cff);
      margin: 0;
    }
  `;

  @property({ reflect: true }) placement: WidgetPosition = 'bottom-right';

  @state() private mic = false;

  override render() {
    return html`
      <button @click=${() => this.pick('annotate')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Annotate a screenshot
      </button>
      <button @click=${() => this.pick('video')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 7 16 12l7 5V7Z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        Record a video
      </button>
      <label class="mic">
        <input type="checkbox" .checked=${this.mic} @change=${this.onMicToggle} />
        Include microphone in video
      </label>
    `;
  }

  private onMicToggle(event: Event) {
    this.mic = (event.target as HTMLInputElement).checked;
  }

  private pick(mode: ModeDetail['mode']) {
    emitInternal<ModeDetail>(this, InternalEvents.mode, { mode, mic: this.mic });
  }
}

if (!customElements.get('fw-menu')) customElements.define('fw-menu', FwMenu);
