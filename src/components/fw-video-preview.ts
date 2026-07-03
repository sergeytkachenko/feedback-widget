import { LitElement, css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { InternalEvents, emitInternal } from '../core/events.js';
import type { PreviewSubmitDetail } from '../core/events.js';

export class FwVideoPreview extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 18, 24, 0.5);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card {
      background: #ffffff;
      color: #1c2030;
      border-radius: 16px;
      box-shadow: 0 18px 60px rgba(15, 18, 24, 0.35);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: min(78vw, 960px);
      max-height: 90vh;
      overflow: auto;
    }
    video {
      display: block;
      max-width: min(70vw, 880px);
      max-height: 52vh;
      border-radius: 8px;
      background: #000000;
    }
    textarea {
      resize: vertical;
      min-height: 64px;
      border: 1px solid rgba(15, 18, 24, 0.16);
      border-radius: 10px;
      padding: 10px 12px;
      font: 400 14px/1.4 system-ui, -apple-system, sans-serif;
      color: inherit;
    }
    textarea:focus {
      outline: 2px solid var(--fw-accent, #6d5cff);
      outline-offset: -1px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      border: 1px solid rgba(15, 18, 24, 0.16);
      background: #ffffff;
      color: #1c2030;
      border-radius: 10px;
      padding: 9px 18px;
      font: 500 14px/1 system-ui, -apple-system, sans-serif;
      cursor: pointer;
    }
    .btn.primary {
      background: var(--fw-accent, #6d5cff);
      border-color: var(--fw-accent, #6d5cff);
      color: #ffffff;
    }
  `;

  @property({ attribute: false }) video?: Blob;

  @state() private videoUrl = '';

  @query('textarea') private descriptionField?: HTMLTextAreaElement;

  override render() {
    return html`
      <div class="card">
        <video controls src=${this.videoUrl}></video>
        <textarea placeholder="Describe the problem"></textarea>
        <div class="actions">
          <button class="btn" @click=${this.discard}>Discard</button>
          <button class="btn primary" @click=${this.submit}>Send</button>
        </div>
      </div>
    `;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('video')) {
      if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = this.video ? URL.createObjectURL(this.video) : '';
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
  }

  private discard() {
    emitInternal(this, InternalEvents.cancel);
  }

  private submit() {
    emitInternal<PreviewSubmitDetail>(this, InternalEvents.previewSubmit, {
      description: this.descriptionField?.value.trim() ?? ''
    });
  }
}

if (!customElements.get('fw-video-preview')) customElements.define('fw-video-preview', FwVideoPreview);
