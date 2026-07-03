import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_MIME_CANDIDATES, RecorderSession, VIDEO_MIME_CANDIDATES, pickMimeType } from '../src/core/recorder.js';

class FakeMediaRecorder extends EventTarget {
  static created: FakeMediaRecorder[] = [];

  state: RecordingState = 'inactive';

  mimeType: string;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? '';
    FakeMediaRecorder.created.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.dispatchEvent(new Event('stop'));
  }

  emitChunk(data: Blob) {
    const event = new Event('dataavailable') as Event & { data: Blob };
    event.data = data;
    this.dispatchEvent(event);
  }
}

afterEach(() => {
  FakeMediaRecorder.created = [];
  vi.unstubAllGlobals();
});

describe('pickMimeType', () => {
  it('returns the first supported candidate', () => {
    const supported = (type: string) => type === 'video/webm;codecs=vp8,opus' || type === 'video/webm';
    expect(pickMimeType(VIDEO_MIME_CANDIDATES, supported)).toBe('video/webm;codecs=vp8,opus');
  });

  it('returns undefined when nothing is supported', () => {
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, () => false)).toBeUndefined();
  });

  it('respects candidate order', () => {
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, () => true)).toBe('audio/webm;codecs=opus');
  });
});

describe('RecorderSession', () => {
  it('assembles chunks into a single blob typed from the first chunk', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const session = new RecorderSession();
    session.start({} as MediaStream, 'video/webm');
    const recorder = FakeMediaRecorder.created[0];
    expect(recorder).toBeDefined();
    recorder?.emitChunk(new Blob(['aa'], { type: 'video/webm' }));
    recorder?.emitChunk(new Blob(['bbb'], { type: 'video/webm' }));
    const blob = await session.stop();
    expect(blob.size).toBe(5);
    expect(blob.type).toBe('video/webm');
  });

  it('drops empty chunks', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const session = new RecorderSession();
    session.start({} as MediaStream, 'audio/webm');
    const recorder = FakeMediaRecorder.created[0];
    recorder?.emitChunk(new Blob([], { type: 'audio/webm' }));
    recorder?.emitChunk(new Blob(['xy'], { type: 'audio/webm' }));
    const blob = await session.stop();
    expect(blob.size).toBe(2);
  });

  it('resolves immediately when the recorder already stopped', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const session = new RecorderSession();
    session.start({} as MediaStream, 'video/webm');
    const recorder = FakeMediaRecorder.created[0];
    recorder?.emitChunk(new Blob(['zz'], { type: 'video/webm' }));
    recorder?.stop();
    const blob = await session.stop();
    expect(blob.size).toBe(2);
  });

  it('rejects when stop is called before start', async () => {
    const session = new RecorderSession();
    await expect(session.stop()).rejects.toThrow('Recorder not started');
  });

  it('reports recording status', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const session = new RecorderSession();
    expect(session.isRecording).toBe(false);
    session.start({} as MediaStream);
    expect(session.isRecording).toBe(true);
  });
});
