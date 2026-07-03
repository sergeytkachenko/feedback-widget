# ADR 0002: snapDOM capture engine, optional native path, capture-first flow

## Status

Accepted. Supersedes the screenshot-capture section of ADR 0001 (event contract, build,
and video-mode decisions there remain in force).

## Context

ADR 0001 chose DOM serialization via `modern-screenshot`. On a production SPA this froze
the main thread for 8.6 s: profiling showed ~78% of the time in CSSOM churn
(`setProperty`/`getPropertyValue`/`item`) because modern-screenshot copies every computed
style property onto every cloned element as inline styles. A property whitelist
(v0.1.1) reduced but could not remove the architectural cost.

A survey of 2025–2026 practice showed three viable models: real-pixel grabs via
`getDisplayMedia` (Sentry), DOM snapshots rendered server-side (Marker.io, Usersnap,
Gleap — requires a backend, which this widget deliberately does not have), and client
DOM rasterization, where `@zumer/snapdom` replaced the html-to-image lineage by emitting
deduplicated shared CSS classes instead of per-element inline styles, and by fully
supporting shadow DOM with `adoptedStyleSheets` — which Lit-based host pages need.
Sentry's flow also demonstrated that pixel captures must be taken before region
selection, because Chrome's "sharing this tab" bar reflows the page after the prompt.

## Decision

- Screenshot capture defaults to **snapDOM** (`capture-engine="dom"`): capture
  `document.documentElement` with `exclude` (widget tag + `mask-selector` values,
  `excludeMode: 'hide'`), a `filter` that prunes `display:none` subtrees, and an
  area-guarded scale (`effectiveScale`, 32 MP budget) so huge pages cannot allocate
  runaway canvases; the viewport window is then cropped out of the page canvas.
- An opt-in **native engine** (`capture-engine="native"`) replicates Sentry's verified
  approach: `getDisplayMedia({ preferCurrentTab, selfBrowserSurface: 'include',
  surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude' })`, one decoded frame via
  `requestVideoFrameCallback`, `drawImage`, immediate track stop. Gated by
  `isNativeCaptureSupported` (secure context, desktop UA, API present) with silent
  fallback to `dom`.
- The annotate flow is **capture-first**: menu click → freeze frame (widget hidden via
  the `capturing` attribute) → region selection happens over the frozen image → the
  crop is cut from the stored frame. No second capture; WYSIWYG selection; the only
  ordering compatible with the native engine. Crop math is per-axis
  (`toCanvasRect`) because a native frame's size can differ from
  `viewport × devicePixelRatio`.
- Privacy masking via a `mask-selector` attribute (comma-separated CSS selectors,
  industry pattern per Gleap `gl-mask` / LogRocket `data-private`), effective in the
  `dom` engine only.
- snapDOM's `preCache()` runs when the menu opens to warm style/resource caches.
- `modern-screenshot`, the `capture-fidelity` attribute, and the property whitelist are
  removed (breaking, v0.2.0).

## Consequences

- Large-page captures drop from multi-second freezes to tens–hundreds of milliseconds
  (snapDOM dedups styles; repeat captures hit its MutationObserver-invalidated caches).
- Lit / web-component host pages are captured correctly (shadow roots, slots,
  constructable stylesheets).
- The npm ESM build externalizes `@zumer/snapdom` (~41 kB widget bundle); the
  self-contained IIFE grows to ~185 kB (58 kB gzip) with snapDOM inlined.
- WebGL/cross-origin-iframe content still cannot be DOM-rendered; the documented
  escape hatch is the native engine, which trades a one-click Chromium share prompt for
  pixel-perfect frames.
- Masking is not possible on native captures; the README documents this asymmetry.
- Scroll positions inside inner scroll containers are not reproduced by DOM cloning
  (pre-existing limitation, unchanged).
