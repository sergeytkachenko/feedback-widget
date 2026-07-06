# ADR 0005: single fast capture path, priming removed

## Status

Accepted. Supersedes ADR 0004 and the priming decision of ADR 0003 (their viewport
rasterization, click-time crop semantics, and precomputed visibility filter carry over
into the unified path below).

## Context

Priming was tried in both available snapDOM modes and a production trace exists for
each. `fast: true` at menu open (0.3.0, `Trace-20260706T160602`) froze the page for
9.3 s. `fast: false` idle-chunked (0.3.1, `Trace-20260706T164725`) kept the page
responsive but ran ~4–5× slower than a fast capture, so the primed snapshot was
practically never ready: in the 0.3.1 trace the user clicked "Annotate a screenshot"
1.15 s after opening the menu, paid the full ~4.9 s fresh capture anyway, and the
abandoned idle prime kept consuming CPU through the region-selection phase. Priming
only ever helped users who dwell in the menu for multiples of the capture time, while
adding two capture modes, session promise plumbing, and wasted double work for
everyone else.

Separately, the capture had two rasterization paths: direct viewport drawing on
Chromium for pages within the browser image-decode limit, and the legacy 0.2.x
full-page `toCanvas()` + crop fallback for WebKit and oversized pages. The fallback
produced unusable crops on very long pages (90×54 px at 116 000 px page height) and
withheld the sharp path from Safari.

## Decision

- **No priming.** The menu opens with zero background work. The capture runs once, on
  the annotate click, always with `fast: true` — the user has explicitly asked for a
  screenshot and is waiting. `SnapshotOptions`, the `PageSnapshot` indirection, and the
  primed/pending session state are deleted.
- **One rasterization path.** The snapshot SVG is loaded once and the viewport
  rectangle is drawn directly at the viewport-budgeted scale on every browser and page
  size. Pages beyond the image-decode limit (16 384 px per side, ~268 MP) get their SVG
  `width`/`height` attributes rewritten by a clamp factor before decoding
  (`decodeClampFactor` + `clampSvgUrl`); since the `viewBox` is preserved and Chromium
  re-rasterizes SVG vector content at the destination resolution, the viewport crop
  stays sharp (verified by edge-energy comparison: a 116 000 px page yields the same
  3000×1800 full-DPR crop as a viewport-sized page, versus 90×54 px before). WebKit
  gets snapDOM's own decode-and-composite settle (decode → offscreen attach → double
  rAF) folded into the same path.

## Consequences

- Menu open measures 0 ms of main-thread blocking (0.3.1: ~335 ms; 0.3.0: 2.4–9.3 s).
- The annotate wait equals one fast capture: ~0.4 s on a viewport-sized page, ~2.4 s at
  7 000 elements, ~16 s at 41 000 elements. The instant-selector path for long menu
  dwells is gone — deliberately traded for predictability and simplicity.
- Screenshots are full device-pixel-ratio sharp on every page length; the 32 MP
  page-area scale reduction and the 90×54 px degenerate crops are gone.
- Element-count-bound capture cost remains snapDOM-internal (ADR 0003 context); the
  documented escape hatch for element-heavy pages is `capture-engine="native"`.
