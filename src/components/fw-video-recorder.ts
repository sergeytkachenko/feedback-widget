import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { InternalEvents, emitInternal } from '../core/events.js';
import type { InternalErrorDetail, RecordedDetail } from '../core/events.js';
import { DEFAULT_RECORDING_LIMITS, LAST_CALL_SEC, type RecordingLimits } from '../core/limits.js';
import { RecorderSession, VIDEO_MIME_CANDIDATES, pickMimeType } from '../core/recorder.js';
import { formatElapsed } from '../core/time.js';

export class FwVideoRecorder extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(15, 18, 24, 0.9);
      color: #ffffff;
      border-radius: 999px;
      padding: 8px 10px 8px 16px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 8px 30px rgba(15, 18, 24, 0.35);
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #e0342f;
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.3;
      }
    }
    .timer {
      font: 500 13px/1 ui-monospace, monospace;
    }
    .remaining {
      font: 600 12px/1 system-ui, -apple-system, sans-serif;
      color: #ffb4a1;
    }
    button {
      border: none;
      background: #e0342f;
      color: #ffffff;
      border-radius: 999px;
      padding: 7px 14px;
      font: 600 13px/1 system-ui, -apple-system, sans-serif;
      cursor: pointer;
    }
  `;

  @property({ attribute: false }) stream?: MediaStream;

  @property({ attribute: false }) limits: RecordingLimits = DEFAULT_RECORDING_LIMITS;

  @state() private elapsed = 0;

  private session = new RecorderSession();

  private timer?: ReturnType<typeof setInterval>;

  private finished = false;

  private get remaining(): number {
    return Math.max(0, this.limits.maxDurationSec - this.elapsed);
  }

  override render() {
    const lastCall = this.remaining <= LAST_CALL_SEC;
    return html`
      <span class="dot"></span>
      <span class="timer">${formatElapsed(this.elapsed)}</span>
      ${lastCall
        ? html`<span class="remaining" role="status">${this.remaining}s left</span>`
        : nothing}
      <button @click=${this.finish}>Stop</button>
    `;
  }

  override firstUpdated() {
    const stream = this.stream;
    if (!stream) {
      this.fail(new Error('No capture stream provided'));
      return;
    }
    try {
      this.session.start(stream, pickMimeType(VIDEO_MIME_CANDIDATES), {
        timesliceMs: 1000,
        videoBitsPerSecond: this.limits.videoBitsPerSecond,
        audioBitsPerSecond: this.limits.audioBitsPerSecond
      });
    } catch (cause) {
      this.fail(cause);
      return;
    }
    this.timer = setInterval(() => {
      this.elapsed += 1;
      if (this.elapsed >= this.limits.maxDurationSec) void this.finish();
    }, 1000);
    const videoTrack = stream.getVideoTracks()[0];
    videoTrack?.addEventListener('ended', () => void this.finish());
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.timer) clearInterval(this.timer);
    if (!this.finished && this.session.isRecording) {
      this.finished = true;
      void this.session.stop().catch(() => undefined);
    }
  }

  private fail(cause: unknown) {
    emitInternal<InternalErrorDetail>(this, InternalEvents.error, {
      stage: 'video',
      message: 'Screen recording failed to start',
      cause
    });
  }

  private async finish() {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    const video = await this.session.stop();
    emitInternal<RecordedDetail>(this, InternalEvents.recorded, { video });
  }
}

if (!customElements.get('fw-video-recorder')) customElements.define('fw-video-recorder', FwVideoRecorder);
