import type { DisplayCaptureOptions } from '../types.js';

export function acquireDisplayStream(): Promise<MediaStream> {
  const options: DisplayCaptureOptions = {
    video: true,
    audio: false,
    preferCurrentTab: true
  };
  return navigator.mediaDevices.getDisplayMedia(options);
}

export function acquireMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function combineStreams(display: MediaStream, mic?: MediaStream): MediaStream {
  return new MediaStream([...display.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
