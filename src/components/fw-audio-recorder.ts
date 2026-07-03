import { LitElement, css, html } from 'lit';
import { state } from 'lit/decorators.js';
import { InternalEvents, emitInternal } from '../core/events.js';
import type { AudioDetail, InternalErrorDetail } from '../core/events.js';
import { AUDIO_MIME_CANDIDATES, RecorderSession, pickMimeType } from '../core/recorder.js';
import { acquireMicStream, stopStream } from '../core/streams.js';
import { formatElapsed } from '../core/time.js';

type RecorderMode = 'idle' | 'recording' | 'recorded';

export class FwAudioRecorder extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(15, 18, 24, 0.16);
      background: #ffffff;
      color: #1c2030;
      border-radius: 999px;
      padding: 7px 14px;
      font: 500 13px/1 system-ui, -apple-system, sans-serif;
      cursor: pointer;
    }
    button:hover {
      background: rgba(15, 18, 24, 0.05);
    }
    button.stop {
      border-color: #e0342f;
      color: #e0342f;
    }
    .dot {
      width: 8px;
      height: 8px;
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
      color: #5a6072;
    }
    audio {
      height: 36px;
      max-width: 240px;
    }
  `;

  @state() private mode: RecorderMode = 'idle';

  @state() private elapsed = 0;

  @state() private audioUrl = '';

  private session = new RecorderSession();

  private stream?: MediaStream;

  private timer?: ReturnType<typeof setInterval>;

  override render() {
    if (this.mode === 'recording') {
      return html`
        <button class="stop" @click=${this.stopRecording}><span class="dot"></span>Stop</button>
        <span class="timer">${formatElapsed(this.elapsed)}</span>
      `;
    }
    if (this.mode === 'recorded') {
      return html`
        <audio controls src=${this.audioUrl}></audio>
        <button @click=${this.clearRecording}>Delete</button>
      `;
    }
    return html`<button @click=${this.startRecording}>🎙 Record audio note</button>`;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.teardown();
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
  }

  private teardown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.stream) stopStream(this.stream);
    this.stream = undefined;
  }

  private async startRecording() {
    try {
      this.stream = await acquireMicStream();
      this.session.start(this.stream, pickMimeType(AUDIO_MIME_CANDIDATES), 500);
      this.elapsed = 0;
      this.timer = setInterval(() => {
        this.elapsed += 1;
      }, 1000);
      this.mode = 'recording';
    } catch (cause) {
      this.teardown();
      emitInternal<InternalErrorDetail>(this, InternalEvents.error, {
        stage: 'audio',
        message: 'Microphone access failed',
        cause
      });
    }
  }

  private async stopRecording() {
    const blob = await this.session.stop();
    this.teardown();
    this.audioUrl = URL.createObjectURL(blob);
    this.mode = 'recorded';
    emitInternal<AudioDetail>(this, InternalEvents.audio, { blob });
  }

  private clearRecording() {
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = '';
    this.elapsed = 0;
    this.mode = 'idle';
    emitInternal(this, InternalEvents.audioClear);
  }
}

if (!customElements.get('fw-audio-recorder')) customElements.define('fw-audio-recorder', FwAudioRecorder);
