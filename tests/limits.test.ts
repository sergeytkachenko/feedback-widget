import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECORDING_LIMITS, LAST_CALL_SEC, estimateRecordingBytes } from '../src/core/limits.js';
import { RecorderSession, recorderOptions } from '../src/core/recorder.js';
import { acquireDisplayStream, displayConstraints } from '../src/core/streams.js';

class FakeMediaRecorder extends EventTarget {
  static created: { options?: MediaRecorderOptions }[] = [];

  state: RecordingState = 'inactive';

  mimeType = '';

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    FakeMediaRecorder.created.push({ options });
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.dispatchEvent(new Event('stop'));
  }
}

function constraintError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

afterEach(() => {
  FakeMediaRecorder.created = [];
  vi.unstubAllGlobals();
});

describe('recording limits', () => {
  it('keeps a full-length recording inside a host upload cap', () => {
    const bytes = estimateRecordingBytes(DEFAULT_RECORDING_LIMITS, DEFAULT_RECORDING_LIMITS.maxDurationSec);

    expect(bytes).toBeLessThan(100 * 1024 * 1024);
  });

  it('warns the reporter before the recording stops itself', () => {
    expect(LAST_CALL_SEC).toBeGreaterThan(0);
    expect(LAST_CALL_SEC).toBeLessThan(DEFAULT_RECORDING_LIMITS.maxDurationSec);
  });
});

describe('recorderOptions', () => {
  it('carries the bitrates the host asked for', () => {
    const options = recorderOptions('video/webm', {
      videoBitsPerSecond: 800_000,
      audioBitsPerSecond: 32_000
    });

    expect(options).toEqual({
      mimeType: 'video/webm',
      videoBitsPerSecond: 800_000,
      audioBitsPerSecond: 32_000
    });
  });

  it('is undefined when there is nothing to ask for', () => {
    expect(recorderOptions(undefined, {})).toBeUndefined();
  });

  it('omits a bitrate the host zeroed out, rather than passing zero', () => {
    expect(recorderOptions('video/webm', { videoBitsPerSecond: 0 })).toEqual({
      mimeType: 'video/webm'
    });
  });
});

describe('RecorderSession bitrate', () => {
  it('constructs MediaRecorder with the bounded bitrate', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const session = new RecorderSession();

    session.start({} as MediaStream, 'video/webm', {
      videoBitsPerSecond: DEFAULT_RECORDING_LIMITS.videoBitsPerSecond,
      audioBitsPerSecond: DEFAULT_RECORDING_LIMITS.audioBitsPerSecond
    });

    expect(FakeMediaRecorder.created[0]?.options).toMatchObject({
      videoBitsPerSecond: DEFAULT_RECORDING_LIMITS.videoBitsPerSecond,
      audioBitsPerSecond: DEFAULT_RECORDING_LIMITS.audioBitsPerSecond
    });
  });
});

describe('displayConstraints', () => {
  it('caps the surface instead of asking for whatever the screen is', () => {
    const constraints = displayConstraints(DEFAULT_RECORDING_LIMITS);

    expect(constraints.video).toEqual({
      width: { max: DEFAULT_RECORDING_LIMITS.maxWidth },
      height: { max: DEFAULT_RECORDING_LIMITS.maxHeight },
      frameRate: { max: DEFAULT_RECORDING_LIMITS.maxFrameRate }
    });
    expect(constraints.preferCurrentTab).toBe(true);
  });
});

describe('acquireDisplayStream', () => {
  it('asks for the capped surface', async () => {
    const stream = {} as MediaStream;
    const getDisplayMedia = vi.fn(async (_options?: unknown) => stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    await expect(acquireDisplayStream()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(getDisplayMedia.mock.calls[0]?.[0]).toMatchObject({
      video: { frameRate: { max: DEFAULT_RECORDING_LIMITS.maxFrameRate } }
    });
  });

  it('falls back to an unconstrained surface when the browser refuses the caps', async () => {
    const stream = {} as MediaStream;
    const getDisplayMedia = vi
      .fn()
      .mockRejectedValueOnce(constraintError('OverconstrainedError'))
      .mockResolvedValueOnce(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    await expect(acquireDisplayStream()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(2);
    expect(getDisplayMedia.mock.calls[1]?.[0]).toMatchObject({ video: true });
  });

  it('does not retry when the reporter declined the share prompt', async () => {
    const getDisplayMedia = vi.fn().mockRejectedValue(constraintError('NotAllowedError'));
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    await expect(acquireDisplayStream()).rejects.toThrow('NotAllowedError');
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });
});
