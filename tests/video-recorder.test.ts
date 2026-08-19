import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/components/fw-video-recorder.js';
import type { FwVideoRecorder } from '../src/components/fw-video-recorder.js';
import { DEFAULT_RECORDING_LIMITS, LAST_CALL_SEC } from '../src/core/limits.js';

class FakeMediaRecorder extends EventTarget {
  static created: FakeMediaRecorder[] = [];

  state: RecordingState = 'inactive';

  mimeType = 'video/webm';

  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
    super();
    FakeMediaRecorder.created.push(this);
  }

  static isTypeSupported() {
    return true;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.dispatchEvent(new Event('stop'));
  }
}

function fakeStream(): MediaStream {
  return { getVideoTracks: () => [new EventTarget()] } as unknown as MediaStream;
}

const limits = { ...DEFAULT_RECORDING_LIMITS, maxDurationSec: 60 };

async function mountRecorder(): Promise<FwVideoRecorder> {
  const element = document.createElement('fw-video-recorder') as FwVideoRecorder;
  element.stream = fakeStream();
  element.limits = limits;
  document.body.appendChild(element);
  await element.updateComplete;
  return element;
}

async function advance(element: FwVideoRecorder, seconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(seconds * 1000);
  await element.updateComplete;
}

function countdownOf(element: FwVideoRecorder): string | null {
  return element.shadowRoot?.querySelector('.remaining')?.textContent?.trim() ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
});

afterEach(() => {
  document.querySelectorAll('fw-video-recorder').forEach((element) => element.remove());
  FakeMediaRecorder.created = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fw-video-recorder duration ceiling', () => {
  it('stops itself at the maximum duration', async () => {
    const element = await mountRecorder();
    const recorded = vi.fn();
    element.addEventListener('fw-recorded', recorded);

    await advance(element, limits.maxDurationSec);

    expect(recorded).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.created[0]?.state).toBe('inactive');
  });

  it('keeps recording right up to the ceiling', async () => {
    const element = await mountRecorder();
    const recorded = vi.fn();
    element.addEventListener('fw-recorded', recorded);

    await advance(element, limits.maxDurationSec - 1);

    expect(recorded).not.toHaveBeenCalled();
  });

  it('says how long is left before it cuts the reporter off', async () => {
    const element = await mountRecorder();

    await advance(element, limits.maxDurationSec - LAST_CALL_SEC);

    expect(countdownOf(element)).toBe(`${LAST_CALL_SEC}s left`);
  });

  it('does not nag while there is plenty of time', async () => {
    const element = await mountRecorder();

    await advance(element, limits.maxDurationSec - LAST_CALL_SEC - 1);

    expect(countdownOf(element)).toBeNull();
  });
});
