import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { InternalEvents, emitInternal } from '../core/events.js';
import type { RegionDetail } from '../core/events.js';
import { isViableRegion, normalizeRect } from '../core/region.js';
import type { Point, Rect } from '../core/region.js';

export class FwRegionSelector extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      overflow: hidden;
      cursor: crosshair;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .frame {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 18, 24, 0.35);
    }
    .marquee {
      position: absolute;
      border: 2px solid var(--fw-accent, #6d5cff);
      box-shadow: 0 0 0 200vmax rgba(15, 18, 24, 0.35);
      pointer-events: none;
    }
    .size {
      position: absolute;
      transform: translateY(6px);
      background: rgba(15, 18, 24, 0.85);
      color: #ffffff;
      font: 12px/1 system-ui, -apple-system, sans-serif;
      padding: 4px 8px;
      border-radius: 6px;
      pointer-events: none;
      white-space: nowrap;
    }
    .hint {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 18, 24, 0.85);
      color: #ffffff;
      font: 13px/1.2 system-ui, -apple-system, sans-serif;
      padding: 9px 16px;
      border-radius: 999px;
      pointer-events: none;
    }
  `;

  @property({ attribute: false }) imageUrl = '';

  @state() private start?: Point;

  @state() private rect?: Rect;

  override render() {
    const rect = this.rect;
    return html`
      ${this.imageUrl ? html`<img class="frame" src=${this.imageUrl} alt="" />` : nothing}
      ${rect ? nothing : html`<div class="backdrop"></div><div class="hint">Drag to select the problem area, Esc to cancel</div>`}
      ${rect
        ? html`
            <div
              class="marquee"
              style=${styleMap({
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`
              })}
            ></div>
            <div class="size" style=${styleMap({ left: `${rect.x}px`, top: `${rect.y + rect.height}px` })}>
              ${rect.width} × ${rect.height}
            </div>
          `
        : nothing}
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('pointerdown', this.onPointerDown);
    this.addEventListener('pointermove', this.onPointerMove);
    this.addEventListener('pointerup', this.onPointerUp);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this.onPointerDown);
    this.removeEventListener('pointermove', this.onPointerMove);
    this.removeEventListener('pointerup', this.onPointerUp);
  }

  private viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  private onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    this.setPointerCapture(event.pointerId);
    this.start = { x: event.clientX, y: event.clientY };
    this.rect = normalizeRect(this.start, this.start, this.viewport());
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.start) return;
    this.rect = normalizeRect(this.start, { x: event.clientX, y: event.clientY }, this.viewport());
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.start) return;
    const rect = normalizeRect(this.start, { x: event.clientX, y: event.clientY }, this.viewport());
    this.start = undefined;
    if (isViableRegion(rect)) {
      emitInternal<RegionDetail>(this, InternalEvents.region, { rect });
    } else {
      this.rect = undefined;
    }
  };
}

if (!customElements.get('fw-region-selector')) customElements.define('fw-region-selector', FwRegionSelector);
