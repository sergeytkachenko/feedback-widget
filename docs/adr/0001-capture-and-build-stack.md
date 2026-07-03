# ADR 0001: Capture approach, integration contract, and build/publish stack

## Status

Accepted

## Context

The widget must let end users report problems on any host page: mark a region of the
screen, draw on it, attach text or an audio note, or record a video of the viewport. It
must be embeddable with one tag on arbitrary sites, stay isolated from host CSS, and hand
the collected artifacts to host business logic without knowing where they get uploaded.
Two capture strategies exist for screenshots: DOM serialization (render the live DOM to a
canvas, as Sentry Feedback and BugHerd do) and the native Screen Capture API
(`getDisplayMedia`), which is pixel-perfect but forces a browser share-picker dialog on
every capture. The package also needs a distribution story for both bundler users and
plain `<script>` consumers, and an unattended release pipeline.

## Decision

- Screenshots use DOM serialization via `modern-screenshot` (`domToCanvas` scoped to the
  viewport with a scroll-offset transform), never `getDisplayMedia`. Video mode is the
  opposite: it uses `getDisplayMedia` with `preferCurrentTab` plus `MediaRecorder`,
  because there is no DOM-based way to record real page activity.
- The widget performs no network calls. The only integration contract is DOM events:
  `feedback-submit` (composed, bubbling, carrying Blobs and metadata in `detail`), plus
  `feedback-open`, `feedback-close`, `feedback-error`. Host code subscribes and uploads.
- The component is Lit 3 with Shadow DOM; all internal child events are non-composed so
  nothing but the four public events crosses the widget boundary.
- Build is Vite library mode in two passes: an ES module with `lit` and
  `modern-screenshot` kept external for npm consumers, and a self-contained IIFE for
  CDN/script-tag use (`unpkg`/`jsdelivr` fields point at it). `lit` is a regular
  dependency, not a peer dependency, per Lit team guidance for component packages.
- Types are rolled into a single `dist/index.d.ts` by `vite-plugin-dts`. Tests run in
  Vitest with jsdom; happy-dom was rejected because it parses Lit child-part markers
  (`<?>`) as text nodes, silently breaking conditional rendering.
- Publishing is tag-driven: pushing `v*` runs typecheck, tests, build, then
  `npm publish --provenance --access public` authenticated by an `NPM_TOKEN` repo secret.

## Consequences

- Screenshot capture needs no permission prompt and feels instant, but is not
  pixel-perfect: cross-origin images require CORS headers, and `position: fixed` elements
  can render at their layout position on scrolled pages. These limits are documented in
  the README.
- Video mode inherits the share-picker UX and Chromium-only `preferCurrentTab`; other
  browsers still work but the user must pick the tab manually.
- Host pages own delivery, storage, and privacy handling of the submitted Blobs; the
  widget stays backend-agnostic and needs no configuration beyond attributes.
- Script-tag users pay ~76 kB (24 kB gzip) for the inlined IIFE; bundler users share one
  `lit` copy across their app.
- Releases require maintaining the `NPM_TOKEN` secret; version comes from `package.json`,
  so the tag and the version field must be bumped together.
