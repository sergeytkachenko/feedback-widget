import { LitElement, css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { InternalEvents, emitInternal } from '../core/events.js';
import type { AudioDetail, EditorSubmitDetail, InternalErrorDetail } from '../core/events.js';
import { canvasToBlob } from '../core/capture.js';
import { renderOp, renderOps, toImagePoint } from '../core/drawing.js';
import type { DrawingOp, DrawingTool } from '../core/drawing.js';
import './fw-audio-recorder.js';

const PALETTE = ['#e0342f', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#111827'];

export class FwAnnotationEditor extends LitElement {
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
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .toolbar .spacer {
      flex: 1;
    }
    .tool {
      border: 1px solid rgba(15, 18, 24, 0.16);
      background: #ffffff;
      color: #1c2030;
      border-radius: 8px;
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
    }
    .tool svg {
      width: 17px;
      height: 17px;
    }
    .tool[data-active] {
      border-color: var(--fw-accent, #6d5cff);
      color: var(--fw-accent, #6d5cff);
      background: rgba(109, 92, 255, 0.08);
    }
    .swatch {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
    }
    .swatch[data-active] {
      border-color: #1c2030;
      box-shadow: inset 0 0 0 2px #ffffff;
    }
    .stage {
      position: relative;
      align-self: center;
      line-height: 0;
    }
    .stage img {
      display: block;
      max-width: min(70vw, 880px);
      max-height: 48vh;
      border-radius: 8px;
    }
    .stage canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: 8px;
    }
    .stage canvas.live {
      cursor: crosshair;
      touch-action: none;
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
      align-items: center;
      gap: 8px;
    }
    .actions .spacer {
      flex: 1;
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

  @property({ attribute: false }) image?: Blob;

  @state() private tool: DrawingTool = 'pen';

  @state() private color = PALETTE[0] ?? '#e0342f';

  @state() private ops: DrawingOp[] = [];

  @state() private imageUrl = '';

  @query('canvas.committed') private committedCanvas?: HTMLCanvasElement;

  @query('canvas.live') private liveCanvas?: HTMLCanvasElement;

  @query('textarea') private descriptionField?: HTMLTextAreaElement;

  private naturalWidth = 0;

  private naturalHeight = 0;

  private baseImage?: HTMLImageElement;

  private liveOp?: DrawingOp;

  private audio?: Blob;

  override render() {
    return html`
      <div class="card">
        <div class="toolbar">
          ${this.toolButton('pen', this.penIcon())}
          ${this.toolButton('rect', this.rectIcon())}
          ${this.toolButton('arrow', this.arrowIcon())}
          ${PALETTE.map(
            (color) => html`
              <button
                class="swatch"
                style="background:${color}"
                aria-label="Color ${color}"
                ?data-active=${this.color === color}
                @click=${() => {
                  this.color = color;
                }}
              ></button>
            `
          )}
          <div class="spacer"></div>
          <button class="tool" aria-label="Undo" ?disabled=${this.ops.length === 0} @click=${this.undo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
        </div>
        <div class="stage">
          <img src=${this.imageUrl} alt="Selected screenshot region" @load=${this.onImageLoad} />
          <canvas class="committed"></canvas>
          <canvas
            class="live"
            @pointerdown=${this.onPointerDown}
            @pointermove=${this.onPointerMove}
            @pointerup=${this.onPointerUp}
          ></canvas>
        </div>
        <textarea placeholder="Describe the problem"></textarea>
        <div class="actions">
          <fw-audio-recorder
            @fw-audio=${this.onAudio}
            @fw-audio-clear=${this.onAudioClear}
            @fw-error=${this.forwardError}
          ></fw-audio-recorder>
          <div class="spacer"></div>
          <button class="btn" @click=${this.cancel}>Cancel</button>
          <button class="btn primary" @click=${this.submit}>Send</button>
        </div>
      </div>
    `;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('image')) {
      if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = this.image ? URL.createObjectURL(this.image) : '';
      this.ops = [];
      this.baseImage = undefined;
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
  }

  private toolButton(tool: DrawingTool, icon: unknown) {
    return html`
      <button
        class="tool"
        aria-label=${tool}
        ?data-active=${this.tool === tool}
        @click=${() => {
          this.tool = tool;
        }}
      >
        ${icon}
      </button>
    `;
  }

  private penIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>`;
  }

  private rectIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>`;
  }

  private arrowIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 19 19 5" />
      <path d="M9 5h10v10" />
    </svg>`;
  }

  private onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    this.baseImage = img;
    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    for (const canvas of [this.committedCanvas, this.liveCanvas]) {
      if (!canvas) continue;
      canvas.width = this.naturalWidth;
      canvas.height = this.naturalHeight;
    }
  }

  private strokeSize() {
    return Math.max(3, Math.round(this.naturalWidth / 240));
  }

  private pointFromEvent(event: PointerEvent) {
    const canvas = this.liveCanvas;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return toImagePoint(event.clientX, event.clientY, rect, this.naturalWidth);
  }

  private context(canvas?: HTMLCanvasElement) {
    return canvas?.getContext('2d') ?? undefined;
  }

  private onPointerDown(event: PointerEvent) {
    if (!this.baseImage) return;
    event.preventDefault();
    (event.target as HTMLCanvasElement).setPointerCapture(event.pointerId);
    const point = this.pointFromEvent(event);
    this.liveOp = { tool: this.tool, color: this.color, size: this.strokeSize(), points: [point, point] };
    this.renderLive();
  }

  private onPointerMove(event: PointerEvent) {
    const op = this.liveOp;
    if (!op) return;
    const point = this.pointFromEvent(event);
    if (op.tool === 'pen') op.points.push(point);
    else op.points = [op.points[0] ?? point, point];
    this.renderLive();
  }

  private onPointerUp() {
    const op = this.liveOp;
    if (!op) return;
    this.liveOp = undefined;
    this.ops = [...this.ops, op];
    this.renderCommitted();
    this.renderLive();
  }

  private renderLive() {
    const ctx = this.context(this.liveCanvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, this.naturalWidth, this.naturalHeight);
    if (this.liveOp) renderOp(ctx, this.liveOp);
  }

  private renderCommitted() {
    const ctx = this.context(this.committedCanvas);
    if (!ctx) return;
    renderOps(ctx, this.ops, this.naturalWidth, this.naturalHeight);
  }

  private undo() {
    this.ops = this.ops.slice(0, -1);
    this.renderCommitted();
  }

  private onAudio(event: CustomEvent<AudioDetail>) {
    this.audio = event.detail.blob;
  }

  private onAudioClear() {
    this.audio = undefined;
  }

  private forwardError(event: CustomEvent<InternalErrorDetail>) {
    emitInternal<InternalErrorDetail>(this, InternalEvents.error, event.detail);
  }

  private cancel() {
    emitInternal(this, InternalEvents.cancel);
  }

  private async submit() {
    if (!this.baseImage) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.naturalWidth;
    exportCanvas.height = this.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(this.baseImage, 0, 0, this.naturalWidth, this.naturalHeight);
    for (const op of this.ops) renderOp(ctx, op);
    const annotatedImage = await canvasToBlob(exportCanvas);
    emitInternal<EditorSubmitDetail>(this, InternalEvents.editorSubmit, {
      annotatedImage,
      description: this.descriptionField?.value.trim() ?? '',
      audio: this.audio
    });
  }
}

if (!customElements.get('fw-annotation-editor')) customElements.define('fw-annotation-editor', FwAnnotationEditor);
