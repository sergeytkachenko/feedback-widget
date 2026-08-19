# ADR 0006: a recording has a ceiling

## Status

Accepted.

## Context

The widget is transport-free: it hands the host Blobs and the host uploads them. That
split left the size of a recording unbounded on the only side that can control it.
`acquireDisplayStream()` asked for `video: true`, so the capture ran at the full surface
resolution and the display's frame rate; `RecorderSession.start()` constructed
`MediaRecorder` with no `videoBitsPerSecond`, so the browser picked; and the elapsed
counter in `fw-video-recorder` was cosmetic, so a recording ended only when the reporter
remembered to stop it.

Two recordings from a production host measured VP9 at 3018×1420 and 3420×1762 with an
Opus narration track, ~0.33 MB/s. A three-minute narrated walkthrough is ~60 MB. That
host capped its endpoint at 25 MB — about 75 seconds — and two consecutive reports were
refused. The reporter could not have known: nothing about the recording UI suggests it is
producing a file no endpoint will take.

The widget cannot know the host's limit. It can stop producing recordings that no
reasonable limit would accept, and it can make the ceiling visible to the person hitting
it.

## Decision

- **The capture surface is capped**, not requested raw: `width`/`height`/`frameRate` go
  into the `getDisplayMedia` request as `max` constraints (1920×1080 at 24 fps by
  default). A browser that refuses the constraints gets one retry with the old
  unconstrained request — a downscaled recording is better than none, and no recording at
  all is worse than both. The retry is narrow: only `OverconstrainedError`,
  `NotSupportedError` and `TypeError` fall back, so a declined share prompt still fails
  as a declined share prompt.
- **`MediaRecorder` is given an explicit bitrate** — 1.2 Mbps video, 64 kbps audio by
  default. With the duration ceiling below, a full-length recording lands under 100 MiB,
  which is what a host endpoint can plausibly accept.
- **A recording stops itself at `maxDurationSec`** (600 by default), and the pill shows a
  countdown for the last 30 seconds so the ceiling arrives announced rather than as a
  silent cut.
- **Every number is a host attribute**: `max-duration-sec`, `video-bitrate`,
  `audio-bitrate`, `max-capture-width`, `max-capture-height`, `max-frame-rate`. Only the
  host knows what its endpoint accepts, so the defaults are a starting point, not a
  policy. `RecordingLimits` and `DEFAULT_RECORDING_LIMITS` are exported so a host can
  compute against them.

The audio note keeps its previous behaviour. It is seconds long, not minutes, and was
never the problem.

## Consequences

Recordings are visibly softer than the retina originals — 1080p at 24 fps against a
3420×1762 surface. For a bug report about layout, text, or a broken flow, that is legible;
for one about a hairline rendering artefact it may not be, and the host can raise
`max-capture-width` when that matters.

Defaults change what existing hosts get on upgrade without any code change on their side.
That is the point — the previous default was "whatever the machine produces" — but it is a
behaviour change in a minor release, and the README documents each number so a host that
wants the old behaviour can set the attributes back.

`estimateRecordingBytes()` makes the arithmetic between bitrate and duration checkable in
a test rather than asserted in prose, so the defaults cannot drift into a combination that
exceeds a sane cap without the suite noticing.
