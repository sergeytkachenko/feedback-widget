export const VIDEO_MIME_CANDIDATES: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4'
];

export const AUDIO_MIME_CANDIDATES: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4'
];

export type MimeTypeSupport = (type: string) => boolean;

function defaultSupport(type: string): boolean {
  return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
}

export function pickMimeType(candidates: readonly string[], isSupported: MimeTypeSupport = defaultSupport): string | undefined {
  return candidates.find((type) => isSupported(type));
}

export interface RecorderOptions {
  timesliceMs?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

export function recorderOptions(mimeType: string | undefined, options: RecorderOptions): MediaRecorderOptions | undefined {
  const settings: MediaRecorderOptions = {};
  if (mimeType) settings.mimeType = mimeType;
  if (options.videoBitsPerSecond) settings.videoBitsPerSecond = options.videoBitsPerSecond;
  if (options.audioBitsPerSecond) settings.audioBitsPerSecond = options.audioBitsPerSecond;
  return Object.keys(settings).length > 0 ? settings : undefined;
}

export class RecorderSession {
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];

  start(stream: MediaStream, mimeType?: string, options: RecorderOptions = {}): void {
    this.chunks = [];
    const settings = recorderOptions(mimeType, options);
    this.recorder = settings ? new MediaRecorder(stream, settings) : new MediaRecorder(stream);
    this.recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.recorder.start(options.timesliceMs ?? 1000);
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error('Recorder not started'));
    const assemble = () => {
      const type = this.chunks[0]?.type || recorder.mimeType || '';
      return type ? new Blob(this.chunks, { type }) : new Blob(this.chunks);
    };
    if (recorder.state === 'inactive') return Promise.resolve(assemble());
    return new Promise((resolve) => {
      recorder.addEventListener('stop', () => resolve(assemble()), { once: true });
      recorder.stop();
    });
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }
}
