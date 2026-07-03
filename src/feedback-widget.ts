import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { FeedbackEvents, emitPublic } from './core/events.js';
import type {
  EditorSubmitDetail,
  InternalErrorDetail,
  ModeDetail,
  PreviewSubmitDetail,
  RecordedDetail,
  RegionDetail
} from './core/events.js';
import { canTransition } from './core/state.js';
import type { WidgetState } from './core/state.js';
import { captureViewport, cropCanvas, nextPaint } from './core/capture.js';
import { toDeviceRect } from './core/region.js';
import type { Rect } from './core/region.js';
import { buildMeta, buildSubmitDetail } from './core/payload.js';
import { acquireDisplayStream, acquireMicStream, combineStreams, stopStream } from './core/streams.js';
import type { FeedbackErrorStage, FeedbackRegion, WidgetPosition } from './types.js';
import './components/fw-menu.js';
import './components/fw-region-selector.js';
import './components/fw-annotation-editor.js';
import './components/fw-video-recorder.js';
import './components/fw-video-preview.js';

interface WidgetSession {
  region?: FeedbackRegion;
  screenshot?: Blob;
  cropped?: Blob;
  video?: Blob;
  combined?: MediaStream;
  streams: MediaStream[];
}

function createSession(): WidgetSession {
  return { streams: [] };
}

export class FeedbackWidget extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      z-index: 2147483000;
      font-family: system-ui, -apple-system, sans-serif;
    }
    :host([capturing]) {
      visibility: hidden;
    }
    .launcher {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: var(--fw-accent, #6d5cff);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 22px rgba(15, 18, 24, 0.28);
      padding: 0;
    }
    .launcher:hover {
      filter: brightness(1.08);
    }
    .launcher svg {
      width: 24px;
      height: 24px;
    }
  `;

  @property() position: WidgetPosition = 'bottom-right';

  @property({ type: Number, attribute: 'offset-x' }) offsetX = 24;

  @property({ type: Number, attribute: 'offset-y' }) offsetY = 24;

  @property({ type: Number, attribute: 'z-index' }) zIndex?: number;

  @property({ attribute: 'accent-color' }) accentColor?: string;

  @state() private uiState: WidgetState = 'idle';

  @query('.launcher') private launcher?: HTMLButtonElement;

  private session = createSession();

  override render() {
    return html`
      <button
        class="launcher"
        aria-label="Send feedback"
        aria-expanded=${this.uiState !== 'idle'}
        @click=${this.onLauncherClick}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
      </button>
      ${this.renderStage()}
    `;
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('position') || changed.has('offsetX') || changed.has('offsetY')) this.applyPlacement();
    if (changed.has('zIndex') && this.zIndex !== undefined) this.style.zIndex = String(this.zIndex);
    if (changed.has('accentColor') && this.accentColor) this.style.setProperty('--fw-accent', this.accentColor);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeWindowListeners();
    this.resetSession();
  }

  private renderStage() {
    switch (this.uiState) {
      case 'menu':
        return html`<fw-menu placement=${this.position} @fw-mode=${this.onMode} @fw-dismiss=${this.closeFlow}></fw-menu>`;
      case 'selecting':
        return html`<fw-region-selector @fw-region=${this.onRegion} @fw-cancel=${this.closeFlow}></fw-region-selector>`;
      case 'editing':
        return html`<fw-annotation-editor
          .image=${this.session.cropped}
          @fw-editor-submit=${this.onEditorSubmit}
          @fw-cancel=${this.closeFlow}
          @fw-error=${this.onChildError}
        ></fw-annotation-editor>`;
      case 'recording':
        return html`<fw-video-recorder
          .stream=${this.session.combined}
          @fw-recorded=${this.onRecorded}
          @fw-error=${this.onChildError}
        ></fw-video-recorder>`;
      case 'video-preview':
        return html`<fw-video-preview
          .video=${this.session.video}
          @fw-preview-submit=${this.onPreviewSubmit}
          @fw-cancel=${this.closeFlow}
        ></fw-video-preview>`;
      default:
        return nothing;
    }
  }

  private applyPlacement() {
    const { style } = this;
    style.top = 'auto';
    style.bottom = 'auto';
    style.left = 'auto';
    style.right = 'auto';
    if (this.position.startsWith('top')) style.top = `${this.offsetY}px`;
    else style.bottom = `${this.offsetY}px`;
    if (this.position.endsWith('left')) style.left = `${this.offsetX}px`;
    else style.right = `${this.offsetX}px`;
  }

  private setUiState(next: WidgetState) {
    if (this.uiState === next || !canTransition(this.uiState, next)) return;
    const wasIdle = this.uiState === 'idle';
    this.uiState = next;
    if (next === 'idle') this.removeWindowListeners();
    else if (wasIdle) this.addWindowListeners();
  }

  private addWindowListeners() {
    window.addEventListener('keydown', this.onWindowKeyDown, true);
    window.addEventListener('pointerdown', this.onWindowPointerDown, true);
  }

  private removeWindowListeners() {
    window.removeEventListener('keydown', this.onWindowKeyDown, true);
    window.removeEventListener('pointerdown', this.onWindowPointerDown, true);
  }

  private onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.closeFlow();
  };

  private onWindowPointerDown = (event: PointerEvent) => {
    if (this.uiState !== 'menu') return;
    if (event.composedPath().includes(this)) return;
    this.closeFlow();
  };

  private onLauncherClick() {
    if (this.uiState === 'idle') {
      this.setUiState('menu');
      emitPublic(this, FeedbackEvents.open);
      return;
    }
    if (this.uiState === 'menu') this.closeFlow();
  }

  private closeFlow() {
    if (this.uiState === 'idle') return;
    this.setUiState('idle');
    this.resetSession();
    emitPublic(this, FeedbackEvents.close);
    void this.updateComplete.then(() => this.launcher?.focus());
  }

  private resetSession() {
    for (const stream of this.session.streams) stopStream(stream);
    this.session = createSession();
  }

  private emitError(stage: FeedbackErrorStage, message: string, cause?: unknown) {
    emitPublic<InternalErrorDetail>(this, FeedbackEvents.error, { stage, message, cause });
  }

  private onChildError(event: CustomEvent<InternalErrorDetail>) {
    emitPublic<InternalErrorDetail>(this, FeedbackEvents.error, event.detail);
    if (event.detail.stage === 'video') this.closeFlow();
  }

  private onMode(event: CustomEvent<ModeDetail>) {
    if (event.detail.mode === 'annotate') {
      this.setUiState('selecting');
      return;
    }
    this.startVideo(event.detail.mic);
  }

  private startVideo(mic: boolean) {
    const displayPromise = acquireDisplayStream();
    void (async () => {
      let display: MediaStream;
      try {
        display = await displayPromise;
      } catch (cause) {
        this.emitError('video', 'Screen capture permission was denied', cause);
        this.closeFlow();
        return;
      }
      this.session.streams.push(display);
      let micStream: MediaStream | undefined;
      if (mic) {
        try {
          micStream = await acquireMicStream();
          this.session.streams.push(micStream);
        } catch (cause) {
          this.emitError('audio', 'Microphone access failed, recording without narration', cause);
        }
      }
      this.session.combined = combineStreams(display, micStream);
      this.setUiState('recording');
    })();
  }

  private onRegion(event: CustomEvent<RegionDetail>) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.session.region = { ...event.detail.rect, devicePixelRatio };
    this.setUiState('capturing');
    void this.runCapture(event.detail.rect, devicePixelRatio);
  }

  private async runCapture(rect: Rect, devicePixelRatio: number) {
    try {
      await this.updateComplete;
      this.setAttribute('capturing', '');
      await nextPaint();
      const { canvas, full } = await captureViewport('feedback-widget');
      this.session.screenshot = full;
      this.session.cropped = await cropCanvas(canvas, toDeviceRect(rect, devicePixelRatio));
      this.removeAttribute('capturing');
      this.setUiState('editing');
    } catch (cause) {
      this.removeAttribute('capturing');
      this.emitError('capture', 'Screenshot capture failed', cause);
      this.closeFlow();
    }
  }

  private onEditorSubmit(event: CustomEvent<EditorSubmitDetail>) {
    const detail = buildSubmitDetail(
      'annotation',
      {
        region: this.session.region,
        screenshot: this.session.screenshot,
        annotatedImage: event.detail.annotatedImage,
        description: event.detail.description || undefined,
        audio: event.detail.audio
      },
      buildMeta(window)
    );
    emitPublic(this, FeedbackEvents.submit, detail);
    this.closeFlow();
  }

  private onRecorded(event: CustomEvent<RecordedDetail>) {
    this.session.video = event.detail.video;
    for (const stream of this.session.streams) stopStream(stream);
    this.session.streams = [];
    this.setUiState('video-preview');
  }

  private onPreviewSubmit(event: CustomEvent<PreviewSubmitDetail>) {
    const detail = buildSubmitDetail(
      'video',
      {
        video: this.session.video,
        description: event.detail.description || undefined
      },
      buildMeta(window)
    );
    emitPublic(this, FeedbackEvents.submit, detail);
    this.closeFlow();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedback-widget': FeedbackWidget;
  }
}
