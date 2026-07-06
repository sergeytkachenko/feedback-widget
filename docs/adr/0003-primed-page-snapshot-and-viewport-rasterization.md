# ADR 0003: primed page snapshot and viewport-only rasterization

## Status

Accepted. Amends the capture-flow section of ADR 0002 (engine choice and event contract
there remain in force).

## Context

ADR 0002 predicted large-page captures in "tens–hundreds of milliseconds". A Chrome
performance trace from a production host page (React + Lit design system, ~4 800
elements, `Trace-20260706T142528.json.gz`) showed the real cost of the `dom` engine:
~5.2 s from the "Annotate a screenshot" click to the region selector, of which ~900 ms
were hard main-thread blocks (a 393 ms task rasterizing the SVG, 335 ms of it a full
style recalc of the 4 479-element clone document, plus 251 ms styling and 142 ms parsing
the SVG data URL). CPU sampling attributed the bulk to snapDOM's per-element pipeline:
computed-style reads and clone construction (~2.6 s with heavy GC churn), a second
whole-tree clone appended to `document.body` for root-size measurement (forced reflow),
XML serialization, and full-page rasterization at scale before the widget cropped out
the viewport and threw the rest away.

Benchmarks against the published 0.2.1 build (real Chrome, 1500×900 viewport, dpr 2)
reproduced this: 2.4 s on a 7 000-element page, 15.5 s on a 41 000-element page. The
per-element cost is snapDOM-internal and scales with page size; it cannot be materially
reduced from widget options. What the widget controls is *when* that work happens and
*how much of the result it rasterizes*.

## Decision

- **Prime at menu open.** Opening the menu starts the full DOM snapshot in the
  background (replacing the previous `preCache()` warm-up, which the capture's own
  `cache: 'soft'` policy reset partially discarded anyway). The annotate click awaits
  the primed snapshot instead of starting from scratch, so user decision time is
  subtracted from the wait. Priming is skipped when the native engine will be used
  (it would trigger a permission prompt). A failed primed snapshot falls back to a
  fresh capture.
- **Rasterize at click time, snapshot at open time.** The primed artifact is a
  `PageSnapshot` (decoded full-page SVG image, or the page canvas on fallback), not a
  finished screenshot. The viewport crop is drawn on the annotate click using the
  current scroll offset, so scrolling while the menu is open cannot produce a stale
  crop. Page *content* is the menu-open state; the menu closes on any outside pointer
  interaction, which bounds staleness to the menu's lifetime.
- **Viewport-only rasterization.** When the page fits the browser image-decode limit
  (16 384 px per side, ~268 MP area) and the browser is not WebKit (whose foreignObject
  drawImage quirks snapDOM works around internally), the viewport rectangle is drawn
  directly from the SVG image into a viewport-sized canvas. The full-page intermediate
  canvas and the crop copy disappear, and the scale budget is computed from the
  viewport area instead of the page area — screenshots keep full device-pixel-ratio
  sharpness regardless of page length. Oversized pages and WebKit keep the previous
  full-page `toCanvas()` + crop path.
- **Precomputed visibility filter.** The `display:none` filter no longer calls
  `getComputedStyle` per visited element during the clone (where snapDOM's own probe
  and sandbox mutations made each call risk a forced style recalc — the trace showed 78
  recalcs during cloning). One pre-pass over the clean tree (descending shadow roots,
  skipping hidden subtrees) builds a `WeakSet`, and the filter becomes a lookup.

## Consequences

- Benchmarks (median of 3, annotate click → region selector, 1.5 s of menu decision
  time): 7 000-element page 2 402 ms → 141 ms; 41 000-element page 15 841 ms → 731 ms;
  1 800-element page 444 ms → 55 ms. With an instant click (no decision time) the wait
  equals the old one (±5%); the improvement comes from overlap, not from removing
  snapDOM's per-element cost.
- Screenshot quality improves on pages that previously tripped the 32 MP page-area
  budget: the 1 800-element benchmark page now yields a 3000×1800 frame instead of
  2581×1549.
- Opening the menu now costs a background capture (seconds of CPU on heavy pages) even
  if the user picks video mode or dismisses the menu. Accepted: the menu is a strong
  intent signal, and the previous `preCache()` warm-up already spent (less) background
  work there.
- The screenshot documents the page as of menu open, not annotate click. Accepted for a
  feedback tool; the scroll offset is still applied at click time, and any outside
  interaction that could change the page closes the menu and discards the snapshot.
- Pages taller than the image-decode limit still degrade to a heavily downscaled crop
  (unchanged from 0.2.1); this is a fundamental ceiling of the SVG-image approach.
