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

export class RecorderSession {
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];

  start(stream: MediaStream, mimeType?: string, timesliceMs = 1000): void {
    this.chunks = [];
    this.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.recorder.start(timesliceMs);
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
