# feedback-widget

A framework-agnostic floating feedback web component built with [Lit](https://lit.dev).
A small button sits in a corner of your page; users click it to either **annotate a
screenshot** (select a region, draw on it, add a text description and/or an audio note)
or **record a video** of the viewport. When they hit Send, the widget dispatches a DOM
event with all artifacts as Blobs — your code decides where to upload them. The widget
itself makes no network calls.

## Install

```sh
npm install @xmesh/feedback-widget
```

```ts
import '@xmesh/feedback-widget';
```

```html
<feedback-widget></feedback-widget>
```

Or without a bundler:

```html
<script src="https://unpkg.com/@xmesh/feedback-widget"></script>
<feedback-widget></feedback-widget>
```

Place the element as a direct child of `<body>`. Ancestors with `transform`, `filter`,
or `perspective` would break its fixed positioning.

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `position` | `bottom-right` | Corner for the launcher: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `offset-x` | `24` | Horizontal offset from the corner, px |
| `offset-y` | `24` | Vertical offset from the corner, px |
| `z-index` | `2147483000` | Stacking order of the launcher and overlays |
| `accent-color` | `#6d5cff` | Accent used for the launcher, buttons, and selection marquee |
| `capture-engine` | `dom` | `dom` renders the DOM to an image (no browser prompt); `native` grabs real pixels via the Screen Capture API (pixel-perfect, one share prompt, Chromium desktop only — silently falls back to `dom` elsewhere) |
| `mask-selector` | — | Comma-separated CSS selectors hidden from screenshots (blank boxes, layout preserved). Applies to the `dom` engine only — `native` captures real pixels and cannot mask |

The accent is also exposed as a CSS custom property, so this works too:

```css
feedback-widget {
  --fw-accent: #e0342f;
}
```

## Events

All events bubble and cross the shadow boundary (`composed: true`).

| Event | `detail` | When |
|---|---|---|
| `feedback-open` | — | The launcher was clicked and the menu opened |
| `feedback-close` | — | The flow was closed, cancelled, or submitted |
| `feedback-submit` | `FeedbackSubmitDetail` | The user pressed Send |
| `feedback-error` | `{ stage, message, cause? }` | Capture, microphone, or recording failed |

### `feedback-submit` payload

```ts
interface FeedbackSubmitDetail {
  type: 'annotation' | 'video';
  screenshot?: Blob;
  annotatedImage?: Blob;
  region?: { x: number; y: number; width: number; height: number; devicePixelRatio: number };
  description?: string;
  audio?: Blob;
  video?: Blob;
  meta: {
    url: string;
    userAgent: string;
    viewportWidth: number;
    viewportHeight: number;
    timestamp: string;
  };
}
```

For `type: 'annotation'` you get the full viewport `screenshot` (PNG), the cropped and
drawn-over `annotatedImage` (PNG), the selected `region` in CSS pixels with the device
pixel ratio, and optionally `description` text and an `audio` note (webm/opus). For
`type: 'video'` you get the `video` recording (webm) and optionally `description`.

### Wiring it up

```ts
import type { FeedbackSubmitDetail } from '@xmesh/feedback-widget';

const widget = document.querySelector('feedback-widget');

widget.addEventListener('feedback-submit', async (event) => {
  const detail = event.detail as FeedbackSubmitDetail;
  const form = new FormData();
  form.append('meta', JSON.stringify(detail.meta));
  if (detail.annotatedImage) form.append('image', detail.annotatedImage, 'annotated.png');
  if (detail.audio) form.append('audio', detail.audio, 'note.webm');
  if (detail.video) form.append('video', detail.video, 'recording.webm');
  if (detail.description) form.append('description', detail.description);
  await fetch('/api/feedback', { method: 'POST', body: form });
});
```

## How capture works, and its limits

The annotate flow is capture-first, like an OS screenshot tool: clicking "Annotate a
screenshot" freezes a frame of the viewport, and the region selection happens on top of
that frozen image, so what you select is exactly what you get.

With the default `dom` engine, the frame is produced by serializing the live DOM to a
canvas via [snapDOM](https://github.com/zumerlab/snapdom) — no browser permission
prompt, nothing leaves the page, and shadow DOM (including `adoptedStyleSheets`, so Lit
and other web-component pages) is captured. DOM serialization on element-heavy pages
takes seconds, so once the menu has painted the widget starts a snapshot in the
background at idle priority — the page stays responsive while it runs. If the snapshot
is ready when "Annotate a screenshot" is clicked, only the viewport crop remains and
the editor opens near-instantly; if not, a fresh capture runs at full speed (the same
wait as capturing on click). A ready snapshot's crop always uses the scroll position at
click time, but the page *content* is the state at menu open — the menu closes on any
outside interaction, which bounds that window. Consequences:

- Cross-origin images render only if they are served with CORS headers.
- Content inside cross-origin iframes, native video frames, and WebGL canvases may be
  missing or black in the screenshot — use `capture-engine="native"` on such pages.
- On pages up to the browser image-decode limit (16 384 px per side) the viewport crop
  is rasterized directly at full device-pixel-ratio sharpness; beyond that the capture
  scale is reduced to stay within canvas memory limits, so screenshots of extremely
  long pages come out proportionally blurrier.

With `capture-engine="native"`, the widget uses the same mechanism as Sentry's feedback
widget: `getDisplayMedia({ preferCurrentTab: true })`, one video frame drawn to canvas,
tracks stopped immediately. Pixel-perfect, but the browser shows a one-click share
prompt, and the streamlined current-tab picker is Chromium-only. On unsupported
browsers (or insecure contexts and mobile) it silently falls back to the `dom` engine.

Video mode uses the Screen Capture API: the browser shows a share picker, and on
Chromium the current tab is preselected (`preferCurrentTab`). Recording stops via the
widget pill or the browser's own "Stop sharing" bar. The microphone toggle in the menu
mixes narration into the recording.

## Browser support

Evergreen Chromium, Firefox, and Safari. `preferCurrentTab` is Chromium-only — other
browsers show the generic share picker. Recording mime types fall back automatically
(`vp9` → `vp8` → `webm` → `mp4`).

## Development

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

`npm run dev` opens a demo page that logs every event and previews the submitted blobs.

## Releasing

Bump `version` in `package.json`, commit, then:

```sh
git tag v0.1.0
git push origin main --tags
```

GitHub Actions builds, tests, and publishes to npm with provenance. Requires an
`NPM_TOKEN` repository secret with publish rights for the `@xmesh` scope.

## License

MIT
