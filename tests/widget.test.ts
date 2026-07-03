import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '../src/index.js';
import type { FeedbackWidget } from '../src/index.js';

async function mountWidget(attributes: Record<string, string> = {}): Promise<FeedbackWidget> {
  const widget = document.createElement('feedback-widget');
  for (const [name, value] of Object.entries(attributes)) widget.setAttribute(name, value);
  document.body.appendChild(widget);
  await widget.updateComplete;
  return widget;
}

function launcherOf(widget: FeedbackWidget): HTMLButtonElement {
  const launcher = widget.shadowRoot?.querySelector<HTMLButtonElement>('.launcher');
  if (!launcher) throw new Error('Launcher not rendered');
  return launcher;
}

describe('feedback-widget', () => {
  beforeAll(() => {
    if (!customElements.get('feedback-widget')) throw new Error('Element not registered');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the launcher in the bottom-right corner by default', async () => {
    const widget = await mountWidget();
    expect(launcherOf(widget)).toBeDefined();
    expect(widget.style.bottom).toBe('24px');
    expect(widget.style.right).toBe('24px');
    expect(widget.style.top).toBe('auto');
  });

  it('applies position and offset attributes', async () => {
    const widget = await mountWidget({ position: 'top-left', 'offset-x': '10', 'offset-y': '30' });
    expect(widget.style.top).toBe('30px');
    expect(widget.style.left).toBe('10px');
    expect(widget.style.bottom).toBe('auto');
  });

  it('applies z-index and accent-color attributes', async () => {
    const widget = await mountWidget({ 'z-index': '99', 'accent-color': '#123456' });
    expect(widget.style.zIndex).toBe('99');
    expect(widget.style.getPropertyValue('--fw-accent')).toBe('#123456');
  });

  it('opens the menu and dispatches feedback-open on launcher click', async () => {
    const widget = await mountWidget();
    let opened = false;
    widget.addEventListener('feedback-open', () => {
      opened = true;
    });
    launcherOf(widget).click();
    await widget.updateComplete;
    expect(opened).toBe(true);
    expect(widget.shadowRoot?.querySelector('fw-menu')).not.toBeNull();
  });

  it('closes the menu and dispatches feedback-close on Escape', async () => {
    const widget = await mountWidget();
    let closed = false;
    widget.addEventListener('feedback-close', () => {
      closed = true;
    });
    launcherOf(widget).click();
    await widget.updateComplete;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await widget.updateComplete;
    expect(closed).toBe(true);
    expect(widget.shadowRoot?.querySelector('fw-menu')).toBeNull();
  });

  it('moves to region selection when annotate mode is picked', async () => {
    const widget = await mountWidget();
    launcherOf(widget).click();
    await widget.updateComplete;
    const menu = widget.shadowRoot?.querySelector('fw-menu');
    menu?.dispatchEvent(
      new CustomEvent('fw-mode', { detail: { mode: 'annotate', mic: false }, bubbles: true, composed: false })
    );
    await widget.updateComplete;
    expect(widget.shadowRoot?.querySelector('fw-region-selector')).not.toBeNull();
    expect(widget.shadowRoot?.querySelector('fw-menu')).toBeNull();
  });
});
