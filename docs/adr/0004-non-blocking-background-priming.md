# ADR 0004: non-blocking background priming

## Status

Accepted. Supersedes the "prime at menu open" mechanics of ADR 0003 (viewport-only
rasterization, click-time crop, and the precomputed visibility filter there remain in
force).

## Context

ADR 0003 primed the page snapshot with snapDOM's `fast: true` directly from the
launcher-click handler. A production trace of 0.3.0 (`Trace-20260706T160602.json.gz`,
same host page as the ADR 0003 trace) showed the consequence: the entire clone/style
pipeline ran as a single 9.3 s microtask drain starting at the click, so the page — and
the menu the user had just opened — stayed frozen and unpainted for the duration.
Benchmarks confirmed it structurally: on a 7 000-element page the menu took 2.4 s to
paint with one 2.4 s main-thread block. ADR 0003's benchmarks measured only
annotate-click → selector and missed this entirely; its "instant" results were achieved
by front-loading the freeze into menu open.

snapDOM's `fast: false` mode chunks the same work through `requestIdleCallback`
(50 ms timeout), keeping the main thread responsive — but measured ~4–5× slower
wall-clock (idle prime finishes in ~8–12 s on the 7 000-element page vs 2.4 s fast).
Awaiting an in-flight idle prime on the annotate click was measured at 2.7–4.1 s —
worse than just capturing fresh.

## Decision

- **Prime after the menu paints.** The prime starts only after `updateComplete` plus a
  double `requestAnimationFrame`, and is skipped if the menu already closed or the
  widget disconnected. The menu appears instantly.
- **Prime at idle priority.** The background snapshot runs snapDOM with `fast: false`
  (`SnapshotOptions.background`); interactive captures keep `fast: true`. The direct
  path's warm-up draw is likewise deferred to an idle callback for background primes.
- **Resolved-or-fresh on click.** The annotate click uses the primed snapshot only if
  it has already resolved (stashed via a `then` handler); otherwise it starts a fresh
  `fast: true` capture immediately instead of waiting for the idle prime to crawl to
  completion. The abandoned prime still warms snapDOM's persistent image/background
  caches, so the fresh capture inherits the role the removed `preCache()` warm-up
  played in 0.2.x.

## Consequences

- Menu open on the 7 000-element benchmark page: paints in ~35 ms with ~310 ms total
  main-thread blocking in the following 4 s (0.3.0: 2.4 s frozen; production 0.3.0
  trace: 9.3 s).
- The instant annotate path (~40–110 ms to selector) now requires the user to dwell in
  the menu for roughly 4–5× the fast-capture time (~1.5 s on small pages, ~10 s on the
  7 000-element page, longer still on extreme pages). Faster clicks cost one fresh
  capture — the same wait 0.2.1 charged after every click.
- A single unchunkable style-recalc block (hundreds of ms on element-heavy pages)
  still lands when the snapshot SVG loads during think time; browsers provide no way
  to slice style resolution of the SVG document.
- Two captures can overlap when a user clicks mid-prime (the idle prime is not
  cancellable); the loser's session-cache writes are benign duplicates keyed by
  identical style content.
